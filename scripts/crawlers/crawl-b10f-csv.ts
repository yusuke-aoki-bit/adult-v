import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { parsePerformerNames, isValidPerformerForProduct } from '../../lib/performer-validation';
import { validateProductData } from '../../lib/crawler-utils';

/**
 * b10f.jp CSV クローラー
 *
 * 機能:
 * - b10f.jp CSVデータを取得してパース
 * - 生CSVデータをb10f_raw_csvテーブルに保存
 * - パースしたデータを正規化テーブル（products, product_sources等）に保存
 * - product_raw_data_linksでリレーション作成（リカバリー用）
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-b10f-csv.ts [--limit 100] [--offset 0]
 */

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
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

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

  console.log('=== b10f.jp CSVクローラー（生データ保存対応） ===\n');
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
    errors: 0,
    rawDataSaved: 0,
  };

  try {
    // 1. CSVダウンロード
    const csvData = await downloadCsv();

    // 2. 生CSVデータを保存
    console.log('💾 生CSVデータ保存中...\n');
    const rawCsvResult = await db.execute(sql`
      INSERT INTO b10f_raw_csv (csv_data, fetched_at)
      VALUES (${csvData}, NOW())
      RETURNING id
    `);
    const rawCsvId = (rawCsvResult.rows[0] as any).id;
    stats.rawDataSaved++;
    console.log(`✅ 生CSVデータ保存完了 (raw_csv_id: ${rawCsvId})\n`);

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
            ${item.imageUrl || null},
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

        const productId = (productResult.rows[0] as any).id;
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

        // 10. パッケージ画像を保存
        if (item.imageUrl) {
          // 小サイズ (1s.jpg) と 大サイズ (1.jpg) の両方を保存
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
              (${productId}, 'b10f', ${item.imageUrl}, 'package', 0),
              (${productId}, 'b10f', ${largeImageUrl}, 'package', 1)
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ パッケージ画像保存完了`);
        }

        // 10.5 サンプル動画URL生成（b10fのパターン）
        // b10f.jp のサンプル動画は /images/{id}/{id}.mp4 or /images/{id}/s.mp4 形式
        if (item.imageUrl) {
          const baseImageUrl = item.imageUrl.replace(/\/1s\.jpg$/, '');
          // サンプル動画URLパターン（複数試行）
          const sampleVideoUrl = `${baseImageUrl}/s.mp4`;

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

          console.log(`  🎬 サンプル動画URL保存完了`);
        }

        // 11. カテゴリ保存
        if (item.category && item.category !== '全ての作品') {
          console.log(`  🏷️  カテゴリ保存中: ${item.category}`);

          const categoryResult = await db.execute(sql`
            INSERT INTO categories (name)
            VALUES (${item.category})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const categoryId = (categoryResult.rows[0] as any).id;

          await db.execute(sql`
            INSERT INTO product_categories (product_id, category_id)
            VALUES (${productId}, ${categoryId})
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ カテゴリ保存完了`);
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

              const performerId = (performerResult.rows[0] as any).id;

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

        console.log();

      } catch (error: any) {
        console.error(`  ❌ エラー: ${error.message}\n`);
        stats.errors++;
        continue;
      }
    }

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

  } catch (error: any) {
    console.error('❌ クローラーエラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
