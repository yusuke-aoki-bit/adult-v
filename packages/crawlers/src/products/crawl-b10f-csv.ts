import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parsePerformerNames, isValidPerformerForProduct } from '../lib/performer-validation';
import { validateProductData } from '../lib/crawler-utils';
import { getAIHelper } from '../lib/crawler';
import type { GeneratedDescription } from '../lib/google-apis';
import { saveCsvToGcs } from '../lib/google-apis';
import { getFirstRow, IdRow } from '../lib/crawler';

/**
 * b10f.jp CSV クローラー
 *
 * 機能:
 * - b10f.jp CSVデータを取得してパース
 * - 生CSVデータをb10f_raw_csvテーブルに保存
 * - パースしたデータを正規化テーブル（products, product_sources等）に保存
 * - product_raw_data_linksでリレーション作成（リカバリー用）
 * - AI機能: Gemini APIによる説明文生成・タグ抽出（--no-aiオプションで無効化可能）
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-b10f-csv.ts [--limit 100] [--offset 0] [--no-ai]
 */

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  skippedUnchanged: number;
  errors: number;
  rawDataSaved: number;
}

/**
 * CSVデータのハッシュを計算
 */
function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

interface B10fProduct {
  productId: string;
  releaseDate: string;
  title: string;
  captureCount: string;
  imageType: string;
  imageUrl: string;
  productUrl: string;
  description: string;
  price: string;
  duration: string;
  brand: string;
  category: string;
  performers: string;
}

const B10F_AFFILIATE_ID = '12556';

/**
 * アフィリエイトURL生成
 * 形式: https://b10f.jp/p/{productId}.html?atv={affiliateId}_U{productId}TTXT_12_9
 */
function generateAffiliateUrl(productId: string): string {
  return `https://b10f.jp/p/${productId}.html?atv=${B10F_AFFILIATE_ID}_U${productId}TTXT_12_9`;
}

/**
 * 小サイズ画像URL (1s.jpg) を大サイズ画像URL (1.jpg) に変換
 * b10fの画像サイズ:
 *   1s.jpg: ~60KB (サムネイル)
 *   1.jpg: ~240KB (フルサイズ)
 *   1l.jpg: ~500バイト (プレースホルダー、使用不可)
 */
function getLargeImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  // /1s.jpg → /1.jpg に変換 (1l.jpgはプレースホルダーなので使わない)
  return imageUrl.replace(/\/(\d+)s\.jpg$/, '/$1.jpg');
}

async function downloadCsv(): Promise<string> {
  const url = `https://b10f.jp/csv_home.php?all=1&atype=${B10F_AFFILIATE_ID}&nosep=1`;

  console.log(`📥 CSVダウンロード中: ${url}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const csv = await response.text();

  // 一時ファイルに保存（デバッグ用）
  const tempPath = path.join(process.cwd(), 'tmp', 'b10f-latest.csv');
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  fs.writeFileSync(tempPath, csv, 'utf-8');

  console.log(`✅ CSVダウンロード完了: ${csv.length}バイト`);
  console.log(`💾 保存先: ${tempPath}\n`);

  return csv;
}

function parseCsv(csv: string): B10fProduct[] {
  const lines = csv.split('\n');
  const products: B10fProduct[] = [];

  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSVパース（簡易版 - カンマ区切り）
    const fields = line.split(',');

    if (fields.length < 13) continue; // 必須フィールドが足りない

    products.push({
      productId: fields[0],
      releaseDate: fields[1],
      title: fields[2],
      captureCount: fields[3],
      imageType: fields[4],
      imageUrl: fields[5],
      productUrl: fields[6],
      description: fields[7],
      price: fields[8],
      duration: fields[9],
      brand: fields[10],
      category: fields[11],
      performers: fields[12],
    });
  }

  return products;
}

interface AIContent {
  aiDescription?: GeneratedDescription;
  aiTags?: {
    genres: string[];
    attributes: string[];
    plays: string[];
    situations: string[];
  };
}

/**
 * AI機能を使って説明文とタグを生成（CrawlerAIHelper使用）
 */
async function generateAIContent(
  item: B10fProduct,
  enableAI: boolean = true,
): Promise<AIContent> {
  if (!enableAI) {
    return {};
  }

  console.log('    🤖 AI機能を実行中...');

  // パフォーマー名をパース
  const performerNames = item.performers
    ? parsePerformerNames(item.performers).filter(name => isValidPerformerForProduct(name, item.title))
    : [];

  const aiHelper = getAIHelper();
  const result = await aiHelper.processProduct(
    {
      title: item.title,
      description: item.description,
      performers: performerNames,
      genres: item.category ? [item.category] : undefined,
    },
    {
      extractTags: true,
      translate: false, // 翻訳は別関数で実行
      generateDescription: true,
    }
  );

  // エラーがあれば警告
  if (result.errors.length > 0) {
    console.log(`      ⚠️ AI処理で一部エラー: ${result.errors.join(', ')}`);
  }

  let aiDescription: GeneratedDescription | undefined;
  let aiTags: AIContent['aiTags'];

  // AI説明文
  if (result.description) {
    aiDescription = result.description;
    console.log(`      ✅ AI説明文生成完了`);
    console.log(`         キャッチコピー: ${result.description.catchphrase}`);
  }

  // AIタグ
  if (result.tags && (result.tags.genres.length > 0 || result.tags.attributes.length > 0 || result.tags.plays.length > 0 || result.tags.situations.length > 0)) {
    aiTags = result.tags;
    console.log(`      ✅ AIタグ抽出完了`);
    console.log(`         ジャンル: ${result.tags.genres.join(', ') || 'なし'}`);
    console.log(`         属性: ${result.tags.attributes.join(', ') || 'なし'}`);
  }

  return { aiDescription, aiTags };
}

/**
 * AI生成データをDBに保存
 */
async function saveAIContent(
  db: ReturnType<typeof getDb>,
  productId: number,
  aiContent: AIContent,
): Promise<void> {
  const { aiDescription, aiTags } = aiContent;

  if (!aiDescription && !aiTags) {
    return;
  }

  try {
    if (aiDescription) {
      await db.execute(sql`
        UPDATE products SET
          ai_description = ${JSON.stringify(aiDescription)},
          ai_catchphrase = ${aiDescription.catchphrase},
          ai_short_description = ${aiDescription.shortDescription}
        WHERE id = ${productId}
      `);
    }

    if (aiTags) {
      await db.execute(sql`
        UPDATE products SET
          ai_tags = ${JSON.stringify(aiTags)}
        WHERE id = ${productId}
      `);
    }

    console.log(`    💾 AI生成データを保存しました`);
  } catch (error) {
    // カラムがない場合はスキップ（マイグレーション前）
    console.warn('    ⚠️ AI生成データの保存をスキップ（カラム未作成の可能性）');
  }
}

/**
 * 翻訳機能を使ってタイトルと説明を多言語翻訳（CrawlerAIHelper使用）
 */
async function translateAndSave(
  db: ReturnType<typeof getDb>,
  productId: number,
  title: string,
  description?: string,
): Promise<void> {
  console.log('    🌐 翻訳処理を実行中...');

  try {
    const aiHelper = getAIHelper();
    const translation = await aiHelper.translate(title, description);
    if (!translation) {
      console.log('      ⚠️ 翻訳結果が取得できませんでした');
      return;
    }

    await db.execute(sql`
      UPDATE products
      SET
        title_en = ${translation.en?.title || null},
        title_zh = ${translation.zh?.title || null},
        title_ko = ${translation.ko?.title || null},
        description_en = ${translation.en?.description || null},
        description_zh = ${translation.zh?.description || null},
        description_ko = ${translation.ko?.description || null},
        updated_at = NOW()
      WHERE id = ${productId}
    `);

    console.log(`    ✅ 翻訳完了`);
    if (translation.en?.title) {
      console.log(`       EN: ${translation.en.title.slice(0, 50)}...`);
    }
  } catch (error) {
    console.error('    ❌ 翻訳エラー:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

  console.log('=== b10f.jp CSVクローラー（生データ保存対応） ===');
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}\n`);
  if (limit) {
    console.log(`処理範囲: offset=${offset}, limit=${limit}\n`);
  } else {
    console.log('処理範囲: 全件\n');
  }

  const db = getDb();

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    errors: 0,
    rawDataSaved: 0,
  };

  try {
    // 1. CSVダウンロード
    const csvData = await downloadCsv();

    // 2. ハッシュ計算して重複チェック
    const csvHash = calculateHash(csvData);
    console.log('💾 生CSVデータ保存中...\n');

    // 最新のCSVと比較
    const latestCsvResult = await db.execute(sql`
      SELECT id, hash, processed_at FROM b10f_raw_csv
      ORDER BY fetched_at DESC
      LIMIT 1
    `);
    const latestCsv = getFirstRow<{ id: number; hash: string | null; processed_at: Date | null }>(latestCsvResult);

    let rawCsvId: number;
    let shouldSkipAll = false;

    // ハッシュが同じで処理済みならスキップ
    if (latestCsv && latestCsv.hash === csvHash && latestCsv.processed_at && !forceReprocess) {
      console.log(`⏭️ CSVデータに変更なし＆処理済み - スキップ (raw_csv_id: ${latestCsv.id})\n`);
      rawCsvId = latestCsv.id;
      shouldSkipAll = true;
    } else if (latestCsv && latestCsv.hash === csvHash) {
      // ハッシュ同じだが未処理
      console.log(`✅ CSVデータに変更なし - 既存データを使用 (raw_csv_id: ${latestCsv.id})\n`);
      rawCsvId = latestCsv.id;
    } else {
      // 新規または変更あり - GCS保存を試みる
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const gcsUrl = await saveCsvToGcs('b10f', `b10f-${timestamp}`, csvData);

      const rawCsvResult = await db.execute(sql`
        INSERT INTO b10f_raw_csv (csv_data, gcs_url, hash, fetched_at)
        VALUES (${gcsUrl ? null : csvData}, ${gcsUrl}, ${csvHash}, NOW())
        RETURNING id
      `);
      const rawCsvRow = getFirstRow<IdRow>(rawCsvResult);
      rawCsvId = rawCsvRow!.id;
      stats.rawDataSaved++;
      console.log(`✅ 生CSVデータ保存完了 (raw_csv_id: ${rawCsvId})${gcsUrl ? ' (GCS)' : ' (DB)'}\n`);
    }

    if (shouldSkipAll) {
      console.log('\n=== クロール完了（変更なしでスキップ） ===\n');
      console.log('統計情報:');
      console.table(stats);
      process.exit(0);
    }

    // 3. CSVパース
    console.log('📋 CSVパース中...\n');
    const products = parseCsv(csvData);
    console.log(`✅ パース完了: ${products.length}件の商品\n`);

    // 4. 処理範囲を制限
    const productsToProcess = limit
      ? products.slice(offset, offset + limit)
      : products.slice(offset);

    console.log(`📦 処理対象: ${productsToProcess.length}件\n`);
    stats.totalFetched = productsToProcess.length;

    // 5. 各商品を処理
    for (const [index, item] of productsToProcess.entries()) {
      try {
        console.log(`[${index + 1}/${productsToProcess.length}] 処理中: ${item.title} (ID: ${item.productId})`);

        // 商品データの検証
        const validation = validateProductData({
          title: item.title,
          description: item.description,
          aspName: 'b10f',
          originalId: item.productId,
        });

        if (!validation.isValid) {
          console.log(`  ⚠️ スキップ: ${validation.reason}`);
          continue;
        }

        // normalized_product_id生成: b10f-{productId}
        const normalizedProductId = `b10f-${item.productId}`;

        // 6. productsテーブルにupsert
        const releaseDateParsed = item.releaseDate ? new Date(item.releaseDate) : null;
        const durationMinutes = item.duration ? parseInt(item.duration) : null;
        const priceYen = item.price ? parseInt(item.price) : null;
        // 大サイズ画像URL (1s.jpg → 1.jpg)
        const largeImageUrl = getLargeImageUrl(item.imageUrl);

        const productResult = await db.execute(sql`
          INSERT INTO products (
            normalized_product_id,
            title,
            description,
            release_date,
            duration,
            default_thumbnail_url,
            updated_at
          )
          VALUES (
            ${normalizedProductId},
            ${item.title || ''},
            ${item.description || null},
            ${releaseDateParsed},
            ${durationMinutes},
            ${largeImageUrl || null},
            NOW()
          )
          ON CONFLICT (normalized_product_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            release_date = EXCLUDED.release_date,
            duration = EXCLUDED.duration,
            default_thumbnail_url = EXCLUDED.default_thumbnail_url,
            updated_at = NOW()
          RETURNING id
        `);

        const productRow = getFirstRow<IdRow>(productResult);
        const productId = productRow!.id;
        const isNew = productResult.rowCount === 1;

        if (isNew) {
          stats.newProducts++;
          console.log(`  ✓ 新規商品作成 (product_id: ${productId})`);
        } else {
          stats.updatedProducts++;
          console.log(`  ✓ 商品更新 (product_id: ${productId})`);
        }

        // 7. product_sourcesにupsert
        await db.execute(sql`
          INSERT INTO product_sources (
            product_id,
            asp_name,
            original_product_id,
            affiliate_url,
            price,
            data_source,
            last_updated
          )
          VALUES (
            ${productId},
            'b10f',
            ${item.productId},
            ${generateAffiliateUrl(item.productId)},
            ${priceYen},
            'CSV',
            NOW()
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        console.log(`  ✓ product_sources 保存完了`);

        // 8. product_raw_data_linksにリレーション作成
        await db.execute(sql`
          INSERT INTO product_raw_data_links (
            product_id,
            source_type,
            raw_data_id
          )
          VALUES (
            ${productId},
            'b10f_csv',
            ${rawCsvId}
          )
          ON CONFLICT (product_id, source_type, raw_data_id)
          DO NOTHING
        `);

        console.log(`  ✓ リカバリーリンク作成完了`);

        // 9. サンプル画像を保存（キャプチャ画像）
        if (item.captureCount && parseInt(item.captureCount) > 0) {
          const captureCount = parseInt(item.captureCount);
          console.log(`  📷 サンプル画像保存中 (${captureCount}枚)...`);

          // 既存の画像を削除
          await db.execute(sql`
            DELETE FROM product_images
            WHERE product_id = ${productId}
            AND asp_name = 'b10f'
            AND image_type = 'sample'
          `);

          // キャプチャ画像URLを生成
          // 例: https://ads.b10f.jp/images/142-zmar-146_a/c1.jpg
          const baseImageUrl = item.imageUrl.replace(/\/1s\.jpg$/, '');

          for (let i = 1; i <= captureCount; i++) {
            const captureUrl = `${baseImageUrl}/c${i}.jpg`;

            await db.execute(sql`
              INSERT INTO product_images (
                product_id,
                asp_name,
                image_url,
                image_type,
                display_order
              )
              VALUES (
                ${productId},
                'b10f',
                ${captureUrl},
                'sample',
                ${i - 1}
              )
            `);
          }

          console.log(`  ✓ サンプル画像保存完了`);
        }

        // 10. パッケージ画像を保存（大サイズのみ）
        if (item.imageUrl) {
          // 大サイズのみ保存（1s.jpg → 1.jpg に変換）
          // 1s.jpg は約40KB、1.jpg は約200KB
          const baseImageUrl = item.imageUrl.replace(/\/1s\.jpg$/, '');
          const largeImageUrl = `${baseImageUrl}/1.jpg`;

          await db.execute(sql`
            INSERT INTO product_images (
              product_id,
              asp_name,
              image_url,
              image_type,
              display_order
            )
            VALUES
              (${productId}, 'b10f', ${largeImageUrl}, 'package', 0)
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ パッケージ画像保存完了`);
        }

        // 10.5 サンプル動画URL生成（b10fのパターン）
        // b10f.jp のサンプル動画は https://ads.b10f.jp/flv/{productCode}.mp4 形式
        // imageUrl例: https://ads.b10f.jp/images/142-zmar-147_a/1s.jpg → productCode: 142-zmar-147
        // imageUrl例: https://ads.b10f.jp/images/1-dmow-096/1s.jpg → productCode: 1-dmow-096
        if (item.imageUrl) {
          // imageUrlからproductCodeを抽出（_a, _b などのサフィックスを除去）
          // パターン: /images/{productCode}[_suffix]/1s.jpg
          const productCodeMatch = item.imageUrl.match(/\/images\/([^\/]+?)(?:_[a-z])?\/\d+s?\.jpg/i);
          const productCode = productCodeMatch ? productCodeMatch[1] : null;

          if (productCode) {
            const sampleVideoUrl = `https://ads.b10f.jp/flv/${productCode}.mp4`;

            await db.execute(sql`
              INSERT INTO product_videos (
                product_id,
                asp_name,
                video_url,
                video_type,
                display_order
              )
              VALUES (
                ${productId},
                'b10f',
                ${sampleVideoUrl},
                'sample',
                0
              )
              ON CONFLICT DO NOTHING
            `);

            console.log(`  🎬 サンプル動画URL保存完了: ${sampleVideoUrl}`);
          } else {
            console.log(`  ⚠️ サンプル動画URL生成スキップ（productCode抽出失敗）`);
          }
        }

        // 11. カテゴリ・タグ保存
        if (item.category && item.category !== '全ての作品') {
          console.log(`  🏷️  カテゴリ/タグ保存中: ${item.category}`);

          const categoryResult = await db.execute(sql`
            INSERT INTO categories (name)
            VALUES (${item.category})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const categoryRow = getFirstRow<IdRow>(categoryResult);
          const categoryId = categoryRow!.id;

          await db.execute(sql`
            INSERT INTO product_categories (product_id, category_id)
            VALUES (${productId}, ${categoryId})
            ON CONFLICT DO NOTHING
          `);

          // tagsテーブルにも保存（ジャンルタグとして）
          const tagResult = await db.execute(sql`
            INSERT INTO tags (name, category)
            VALUES (${item.category}, 'genre')
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const tagRow = getFirstRow<IdRow>(tagResult);
          const tagId = tagRow!.id;

          await db.execute(sql`
            INSERT INTO product_tags (product_id, tag_id)
            VALUES (${productId}, ${tagId})
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ カテゴリ/タグ保存完了`);
        }

        // 12. 出演者情報保存（バリデーション付き）
        if (item.performers && item.performers.trim()) {
          // 共通ユーティリティを使用して演者名をパース・検証
          const validPerformerNames = parsePerformerNames(item.performers)
            .filter(name => isValidPerformerForProduct(name, item.title));

          if (validPerformerNames.length > 0) {
            console.log(`  👤 出演者保存中 (${validPerformerNames.length}人)...`);

            for (const performerName of validPerformerNames) {
              const performerResult = await db.execute(sql`
                INSERT INTO performers (name)
                VALUES (${performerName})
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
              `);

              const performerRow = getFirstRow<IdRow>(performerResult);
              const performerId = performerRow!.id;

              await db.execute(sql`
                INSERT INTO product_performers (product_id, performer_id)
                VALUES (${productId}, ${performerId})
                ON CONFLICT DO NOTHING
              `);
            }

            console.log(`  ✓ 出演者保存完了`);
          } else {
            console.log(`  ⚠️  有効な出演者名がありません (元データ: ${item.performers})`);
          }
        }

        // 13. AI機能: 説明文生成とタグ抽出
        if (enableAI) {
          const aiContent = await generateAIContent(item, enableAI);
          await saveAIContent(db, productId, aiContent);
        }

        // 14. 翻訳機能: タイトルと説明を多言語翻訳
        if (enableAI) {
          await translateAndSave(db, productId, item.title, item.description);
        }

        console.log();

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ エラー: ${errorMessage}\n`);
        stats.errors++;
        continue;
      }
    }

    // 処理完了後にCSVを処理済みとしてマーク
    await db.execute(sql`
      UPDATE b10f_raw_csv
      SET processed_at = NOW()
      WHERE id = ${rawCsvId}
    `);
    console.log(`✅ CSVデータを処理済みとしてマーク (raw_csv_id: ${rawCsvId})`);

    console.log('\n=== クロール完了 ===\n');
    console.log('統計情報:');
    console.table(stats);

    // データベースの最終状態を確認
    const finalCounts = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM b10f_raw_csv) as raw_csv_count,
        (SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'b10f-%') as product_count,
        (SELECT COUNT(*) FROM product_sources WHERE asp_name = 'b10f') as source_count,
        (SELECT COUNT(*) FROM product_raw_data_links WHERE source_type = 'b10f_csv') as link_count
    `);

    console.log('\nデータベース状態:');
    console.table(finalCounts.rows);

  } catch (error: unknown) {
    console.error('❌ クローラーエラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
