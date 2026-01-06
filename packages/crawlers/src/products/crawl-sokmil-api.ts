/**
 * SOKMIL API クローラー
 *
 * 機能:
 * - SOKMIL APIから商品データを取得
 * - 生レスポンスをGCS優先で保存（フォールバック: DB）
 * - 重複クロール防止: hash比較
 * - 重複分析防止: processedAtチェック
 * - パースしたデータを正規化テーブルに保存
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-sokmil-api.ts [--limit 100] [--offset 0] [--no-ai] [--force]
 */

import { getSokmilClient, SokmilProduct } from '../lib/providers/sokmil-client';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import {
  getFirstRow,
  IdRow,
  upsertSokmilRawDataWithGcs,
  linkProductToRawData,
  markRawDataAsProcessed,
  RateLimiter,
  crawlerLog,
} from '../lib/crawler';

const SOURCE_NAME = 'SOKMIL';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  skippedUnchanged: number;
  skippedInvalid: number;
  errors: number;
  rawDataSaved: number;
  performersLinked: number;
  tagsLinked: number;
}

/**
 * 年月範囲を生成（配信開始日ベースで全件取得用）
 */
function generateDateRanges(startYear: number, endYear: number): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];

  for (let year = endYear; year >= startYear; year--) {
    for (let month = 12; month >= 1; month--) {
      const start = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:59:59`;
      ranges.push({ start, end });
    }
  }

  return ranges;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');
  const fullScan = args.includes('--full-scan');
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const monthArg = args.find(arg => arg.startsWith('--month='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]!) : 100;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]!) : 0;
  const targetYear = yearArg ? parseInt(yearArg.split('=')[1]!) : null;
  const targetMonth = monthArg ? parseInt(monthArg.split('=')[1]!) : null;

  console.log('========================================');
  console.log('=== SOKMIL APIクローラー (GCS対応) ===');
  console.log('========================================');
  console.log(`取得範囲: offset=${offset}, limit=${limit}`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`フルスキャン: ${fullScan ? '有効' : '無効'}`);
  if (targetYear) console.log(`指定年: ${targetYear}`);
  if (targetMonth) console.log(`指定月: ${targetMonth}`);
  console.log('========================================\n');

  const sokmilClient = getSokmilClient();
  const db = getDb();
  const rateLimiter = new RateLimiter({ minDelayMs: 1000, addJitter: true, jitterRange: 1000 });

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    skippedInvalid: 0,
    errors: 0,
    rawDataSaved: 0,
    performersLinked: 0,
    tagsLinked: 0,
  };

  try {
    const allProducts: SokmilProduct[] = [];

    if (fullScan || targetYear) {
      // フルスキャンモード: 日付範囲で全件取得（50000件制限を回避）
      console.log('🔄 SOKMIL APIからフルスキャンで作品を取得中...\n');

      const currentYear = new Date().getFullYear();
      let dateRanges: Array<{ start: string; end: string }>;

      if (targetYear && targetMonth) {
        // 特定の年月のみ
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        dateRanges = [{
          start: `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01T00:00:00`,
          end: `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay}T23:59:59`,
        }];
      } else if (targetYear) {
        // 特定の年のみ
        dateRanges = generateDateRanges(targetYear, targetYear);
      } else {
        // 2000年から現在まで全期間
        dateRanges = generateDateRanges(2000, currentYear);
      }

      console.log(`📅 取得期間: ${dateRanges.length}ヶ月分\n`);

      for (const range of dateRanges) {
        if (allProducts.length >= limit) break;

        console.log(`\n📆 期間: ${range.start.split('T')[0]} - ${range.end.split('T')[0]}`);

        const hitsPerRequest = 100;
        let currentOffset = 1;
        let periodItems: SokmilProduct[] = [];

        // 最初のリクエストで期間内の総数を取得
        await rateLimiter.wait();
        try {
          const firstResponse = await sokmilClient.searchItems({
            hits: hitsPerRequest,
            offset: currentOffset,
            sort: 'date',
            gte_date: range.start,
            lte_date: range.end,
          });
          rateLimiter.done();

          if (firstResponse.status !== 'success') {
            crawlerLog.error(`API エラー: ${firstResponse.error}`);
            continue;
          }

          if (firstResponse.totalCount === 0 || firstResponse.data.length === 0) {
            console.log(`  ⏭️ この期間には作品がありません`);
            continue;
          }

          console.log(`  📊 期間内件数: ${firstResponse.totalCount.toLocaleString()}件`);

          // ページネーションループ
          let response = firstResponse;
          while (true) {
            if (response.data.length === 0) break;

            periodItems.push(...response.data);
            currentOffset += hitsPerRequest;

            console.log(`  ✅ 取得: ${response.data.length}件 (期間累計: ${periodItems.length}件)`);

            // この期間の全件取得完了
            if (response.data.length < hitsPerRequest || periodItems.length >= firstResponse.totalCount) {
              break;
            }

            // offset上限チェック（期間ごとなので通常は問題ない）
            if (currentOffset > 50000) {
              console.log(`  ⚠️ offset上限(50000)に達しました`);
              break;
            }

            // 全体のlimitに達したら終了
            if (allProducts.length + periodItems.length >= limit) {
              break;
            }

            await rateLimiter.wait();
            try {
              response = await sokmilClient.searchItems({
                hits: hitsPerRequest,
                offset: currentOffset,
                sort: 'date',
                gte_date: range.start,
                lte_date: range.end,
              });
            } finally {
              rateLimiter.done();
            }
          }

          allProducts.push(...periodItems);
          console.log(`  📦 期間合計: ${periodItems.length}件 (全体累計: ${allProducts.length.toLocaleString()}件)`);

        } catch (error) {
          crawlerLog.error(`期間 ${range.start} の取得に失敗:`, error);
          rateLimiter.done();
        }

        // レートリミット対策: 期間ごとに少し待機
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } else {
      // 通常モード: 新着順で取得
      console.log('🔄 SOKMIL APIから新着作品を取得中...\n');

      // 新着作品を取得（正しいAPIパラメータ: hits/offset）
      // Sokmil API仕様: hits(20-100), offset(1-50000), sort(date)
      const hitsPerRequest = 100;  // 最大100件
      let currentOffset = offset + 1;  // APIのoffsetは1から開始
      let totalCount = 0;

      // ページネーションループ（limit件に達するまで、または全件取得まで）
      while (allProducts.length < limit) {
        crawlerLog.info(`offset=${currentOffset} を取得中... (累計: ${allProducts.length}件)`);
        await rateLimiter.wait();

        try {
          const response = await sokmilClient.searchItems({
            hits: hitsPerRequest,
            offset: currentOffset,
            sort: 'date',  // 新着順
          });

          if (response['status'] !== 'success') {
            crawlerLog.error(`API エラー: ${response.error}`);
            break;
          }

          // 最初のリクエストで総件数をログ
          if (currentOffset === offset + 1 && response['totalCount']) {
            totalCount = response['totalCount'];
            console.log(`📊 API総件数: ${totalCount.toLocaleString()}件`);
            console.log(`🎯 取得目標: ${limit === 99999 ? '全件' : limit + '件'}\n`);
          }

          allProducts.push(...response.data);
          crawlerLog.success(`${response.data.length}件取得 (累計: ${allProducts.length.toLocaleString()}件)`);

          if (response.data.length < hitsPerRequest) {
            break; // 最後のページ
          }

          // offset最大50000の制限チェック
          if (currentOffset + hitsPerRequest > 50000) {
            console.log('⚠️ offset上限(50000)に達しました');
            break;
          }

          currentOffset += hitsPerRequest;

          // レートリミット対策: 5000件ごとに休憩
          if (allProducts.length % 5000 === 0 && allProducts.length > 0) {
            console.log('⏳ レートリミット対策: 3秒待機...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (error) {
          crawlerLog.error(`offset=${currentOffset}の取得に失敗:`, error);
          break;
        } finally {
          rateLimiter.done();
        }
      }
    }

    // limitを超えた分をカット
    if (allProducts.length > limit) {
      allProducts.splice(limit);
    }

    console.log(`\n✅ API取得完了: ${allProducts.length}件\n`);
    stats.totalFetched = allProducts.length;

    for (const [index, item] of allProducts.entries()) {
      try {
        crawlerLog.progress(index + 1, allProducts.length, item.itemName.slice(0, 40));

        // 商品データの検証
        const validation = validateProductData({
          title: item.itemName,
          description: item['description'] || '',
          aspName: SOURCE_NAME,
          originalId: item.itemId,
        });

        if (!validation.isValid) {
          console.log(`  ⚠️ スキップ(無効): ${validation.reason}`);
          stats.skippedInvalid++;
          continue;
        }

        // 1. 生データの保存（GCS優先 + 重複チェック）
        const rawData = item as unknown as Record<string, unknown>;
        const upsertResult = await upsertSokmilRawDataWithGcs(item.itemId, 'item', rawData);

        // 重複チェック: 変更なし＆処理済みならスキップ
        if (upsertResult.shouldSkip && !forceReprocess) {
          console.log(`  ⏭️ スキップ(処理済み): ${item.itemId}`);
          stats.skippedUnchanged++;
          continue;
        }

        const rawDataId = upsertResult.id;
        if (upsertResult.isNew) {
          stats.rawDataSaved++;
          console.log(`  ✓ 生データ保存 (raw_id: ${rawDataId})${upsertResult.gcsUrl ? ' [GCS]' : ' [DB]'}`);
        } else if (!upsertResult.shouldSkip) {
          stats.rawDataSaved++;
          console.log(`  🔄 生データ更新 (raw_id: ${rawDataId})${upsertResult.gcsUrl ? ' [GCS]' : ' [DB]'}`);
        }

        // 2. 正規化されたデータを保存
        const normalizedProductId = `sokmil-${item.itemId}`;
        // packageImageUrl (pe_xxx.jpg) はフルサイズ、thumbnailUrl (pef_xxx_100x142.jpg) は小さい
        const thumbnailUrl = item.packageImageUrl || item['thumbnailUrl'];

        const productResult = await db.execute(sql`
          INSERT INTO products (
            normalized_product_id,
            title,
            description,
            release_date,
            duration,
            default_thumbnail_url
          ) VALUES (
            ${normalizedProductId},
            ${item.itemName},
            ${item['description'] || null},
            ${item['releaseDate'] || null},
            ${item['duration'] || null},
            ${thumbnailUrl || null}
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

        if (upsertResult.isNew) {
          stats.newProducts++;
          console.log(`  ✓ 新規商品作成 (product_id: ${productId})`);
        } else {
          stats.updatedProducts++;
          console.log(`  ✓ 商品更新 (product_id: ${productId})`);
        }

        // 3. product_sourcesを保存（ユニーク制約は(product_id, asp_name)）
        await db.execute(sql`
          INSERT INTO product_sources (
            product_id,
            asp_name,
            original_product_id,
            affiliate_url,
            price,
            data_source
          ) VALUES (
            ${productId},
            ${SOURCE_NAME},
            ${item.itemId},
            ${item['affiliateUrl']},
            ${item['price'] || null},
            'API'
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        // 4. 商品と生データをリンク
        await linkProductToRawData(
          productId,
          'sokmil',
          rawDataId,
          'sokmil_raw_responses',
          upsertResult.gcsUrl || `hash:${rawDataId}`
        );

        // 5. 画像を保存（バッチINSERT）
        const imageUrls: string[] = [];
        if (item.packageImageUrl) imageUrls.push(item.packageImageUrl);
        if (item.sampleImages) imageUrls.push(...item.sampleImages);

        if (imageUrls.length > 0) {
          const imageTypes = imageUrls.map((url) =>
            url === item['thumbnailUrl'] || url === item.packageImageUrl ? 'thumbnail' : 'sample'
          );
          const displayOrders = imageUrls.map((_, i) => i);

          await db.execute(sql`
            INSERT INTO product_images (product_id, image_url, image_type, display_order, asp_name)
            SELECT
              ${productId},
              unnest(${imageUrls}::text[]),
              unnest(${imageTypes}::text[]),
              unnest(${displayOrders}::int[]),
              ${SOURCE_NAME}
            ON CONFLICT (product_id, image_url) DO NOTHING
          `);
        }

        // 6. 動画を保存
        if (item['sampleVideoUrl']) {
          await db.execute(sql`
            INSERT INTO product_videos (product_id, video_url, video_type, asp_name)
            VALUES (${productId}, ${item['sampleVideoUrl']}, 'sample', ${SOURCE_NAME})
            ON CONFLICT (product_id, video_url) DO NOTHING
          `);
        }

        // 7. 出演者を保存（バッチ処理）
        if (item.actors && item.actors.length > 0) {
          // バリデーションと正規化を先に行う（nullを除外）
          const validPerformerNames = item.actors
            .filter(actor => isValidPerformerName(actor.name))
            .map(actor => normalizePerformerName(actor.name))
            .filter((name): name is string => name !== null && isValidPerformerForProduct(name, item.itemName));

          if (validPerformerNames.length > 0) {
            // バッチでperformersをupsert
            const performerResults = await db.execute(sql`
              INSERT INTO performers (name)
              SELECT unnest(${validPerformerNames}::text[])
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id, name
            `);

            // 出演者ID-名前マップを作成
            const performerIdMap = new Map<string, number>();
            for (const row of performerResults.rows as { id: number; name: string }[]) {
              performerIdMap.set(row['name'], row['id']);
            }

            // バッチでproduct_performersにリレーション作成
            const performerIds = validPerformerNames
              .map(name => performerIdMap.get(name))
              .filter((id): id is number => id !== undefined);

            if (performerIds.length > 0) {
              await db.execute(sql`
                INSERT INTO product_performers (product_id, performer_id)
                SELECT ${productId}, unnest(${performerIds}::int[])
                ON CONFLICT DO NOTHING
              `);
              stats.performersLinked += performerIds.length;
            }
          }
        }

        // 8. ジャンル/タグを保存（バッチ処理）
        if (item.genres && item.genres.length > 0) {
          const genreNames = item.genres.map((g: { name: string }) => g.name);

          // バッチでtagsをupsert
          const tagResults = await db.execute(sql`
            INSERT INTO tags (name, category)
            SELECT unnest(${genreNames}::text[]), 'genre'
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
          `);

          // タグID-名前マップを作成
          const tagIdMap = new Map<string, number>();
          for (const row of tagResults.rows as { id: number; name: string }[]) {
            tagIdMap.set(row['name'], row['id']);
          }

          // バッチでproduct_tagsにリレーション作成
          const tagIds = genreNames
            .map((name: string) => tagIdMap.get(name))
            .filter((id: number | undefined): id is number => id !== undefined);

          if (tagIds.length > 0) {
            await db.execute(sql`
              INSERT INTO product_tags (product_id, tag_id)
              SELECT ${productId}, unnest(${tagIds}::int[])
              ON CONFLICT DO NOTHING
            `);
            stats.tagsLinked += tagIds.length;
          }
        }

        // 9. メーカー/レーベルをカテゴリとして保存
        if (item.maker) {
          const categoryResult = await db.execute(sql`
            INSERT INTO categories (name)
            VALUES (${item.maker['name']})
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
        }

        // 10. 生データを処理済みとしてマーク
        await markRawDataAsProcessed('sokmil', rawDataId);

        console.log();

        // レート制限
        await rateLimiter.wait();
        rateLimiter.done();

      } catch (error) {
        stats.errors++;
        crawlerLog.error(`商品処理エラー (${item.itemId}):`, error);
      }
    }

    // 統計を表示
    console.log('\n========================================');
    console.log('📊 クロール統計');
    console.log('========================================');
    console.log(`取得件数: ${stats.totalFetched}`);
    console.log(`新規商品: ${stats.newProducts}`);
    console.log(`更新商品: ${stats.updatedProducts}`);
    console.log(`スキップ(変更なし): ${stats.skippedUnchanged}`);
    console.log(`スキップ(無効): ${stats.skippedInvalid}`);
    console.log(`生データ保存: ${stats.rawDataSaved}`);
    console.log(`出演者リンク: ${stats.performersLinked}`);
    console.log(`タグリンク: ${stats.tagsLinked}`);
    console.log(`エラー: ${stats.errors}`);
    console.log('========================================\n');

  } catch (error) {
    crawlerLog.error('クロール処理中にエラーが発生しました:', error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
