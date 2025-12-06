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

import { getSokmilClient, SokmilProduct } from '../../lib/providers/sokmil-client';
import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import { validateProductData } from '../../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import {
  getFirstRow,
  IdRow,
  upsertSokmilRawDataWithGcs,
  linkProductToRawData,
  markRawDataAsProcessed,
  RateLimiter,
  crawlerLog,
} from '../../lib/crawler';

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

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

  console.log('========================================');
  console.log('=== SOKMIL APIクローラー (GCS対応) ===');
  console.log('========================================');
  console.log(`取得範囲: offset=${offset}, limit=${limit}`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
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
    console.log('🔄 SOKMIL APIから新着作品を取得中...\n');

    // 新着作品を取得（ページネーション対応）
    const pageSize = Math.min(limit, 100);
    const totalPages = Math.ceil(limit / pageSize);
    const allProducts: SokmilProduct[] = [];

    for (let page = 1; page <= totalPages; page++) {
      crawlerLog.info(`ページ ${page}/${totalPages} を取得中...`);
      await rateLimiter.wait();

      try {
        const response = await sokmilClient.searchItems({
          page,
          per_page: pageSize,
          sort: 'release_date_desc',
        });

        if (response.status !== 'success') {
          crawlerLog.error(`API エラー: ${response.error}`);
          break;
        }

        allProducts.push(...response.data);
        crawlerLog.success(`${response.data.length}件取得`);

        if (response.data.length < pageSize) {
          break; // 最後のページ
        }
      } catch (error) {
        crawlerLog.error(`ページ${page}の取得に失敗:`, error);
        break;
      } finally {
        rateLimiter.done();
      }
    }

    console.log(`✅ API取得完了: ${allProducts.length}件\n`);
    stats.totalFetched = allProducts.length;

    for (const [index, item] of allProducts.entries()) {
      try {
        crawlerLog.progress(index + 1, allProducts.length, item.itemName.slice(0, 40));

        // 商品データの検証
        const validation = validateProductData({
          title: item.itemName,
          description: item.description || '',
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
        const thumbnailUrl = item.thumbnailUrl || item.packageImageUrl;

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
            ${item.description || null},
            ${item.releaseDate || null},
            ${item.duration || null},
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

        // 3. product_sourcesを保存
        await db.execute(sql`
          INSERT INTO product_sources (
            product_id,
            asp_name,
            original_product_id,
            affiliate_url,
            thumbnail_url,
            price
          ) VALUES (
            ${productId},
            ${SOURCE_NAME},
            ${item.itemId},
            ${item.affiliateUrl},
            ${thumbnailUrl || null},
            ${item.price || null}
          )
          ON CONFLICT (asp_name, original_product_id)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            thumbnail_url = EXCLUDED.thumbnail_url,
            price = EXCLUDED.price,
            updated_at = NOW()
        `);

        // 4. 商品と生データをリンク
        await linkProductToRawData(
          productId,
          'sokmil',
          rawDataId,
          'sokmil_raw_responses',
          upsertResult.gcsUrl || `hash:${rawDataId}`
        );

        // 5. 画像を保存
        const imageUrls: string[] = [];
        if (item.packageImageUrl) imageUrls.push(item.packageImageUrl);
        if (item.sampleImages) imageUrls.push(...item.sampleImages);

        for (const imageUrl of imageUrls) {
          await db.execute(sql`
            INSERT INTO product_images (product_id, image_url, display_order, source)
            VALUES (${productId}, ${imageUrl}, ${imageUrls.indexOf(imageUrl)}, ${SOURCE_NAME})
            ON CONFLICT (product_id, image_url) DO NOTHING
          `);
        }

        // 6. 動画を保存
        if (item.sampleVideoUrl) {
          await db.execute(sql`
            INSERT INTO product_videos (product_id, video_url, video_type, source)
            VALUES (${productId}, ${item.sampleVideoUrl}, 'sample', ${SOURCE_NAME})
            ON CONFLICT (product_id, video_url) DO NOTHING
          `);
        }

        // 7. 出演者を保存
        if (item.actors && item.actors.length > 0) {
          for (const actor of item.actors) {
            if (!isValidPerformerName(actor.name)) continue;

            const normalizedName = normalizePerformerName(actor.name);
            if (!isValidPerformerForProduct(normalizedName, item.itemName)) continue;

            const performerResult = await db.execute(sql`
              INSERT INTO performers (name)
              VALUES (${normalizedName})
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
            stats.performersLinked++;
          }
        }

        // 8. ジャンル/タグを保存
        if (item.genres && item.genres.length > 0) {
          for (const genre of item.genres) {
            const tagResult = await db.execute(sql`
              INSERT INTO tags (name, category)
              VALUES (${genre.name}, 'genre')
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
            stats.tagsLinked++;
          }
        }

        // 9. メーカー/レーベルをカテゴリとして保存
        if (item.maker) {
          const categoryResult = await db.execute(sql`
            INSERT INTO categories (name)
            VALUES (${item.maker.name})
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
