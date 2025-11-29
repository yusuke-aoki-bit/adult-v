import { getSokmilClient } from '../../lib/providers/sokmil-client';
import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import { validateProductData } from '../../lib/crawler-utils';

/**
 * ソクミル API クローラー（生データ保存対応）
 *
 * 機能:
 * - ソクミルAPIから商品データを取得
 * - 生レスポンスをsokmil_raw_responsesテーブルに保存
 * - パースしたデータを正規化テーブル（products, product_sources等）に保存
 * - product_raw_data_linksでリレーション作成（リカバリー用）
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-sokmil-api.ts [--limit 100] [--page 1]
 */

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const pageArg = args.find(arg => arg.startsWith('--page='));

  const perPage = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const startPage = pageArg ? parseInt(pageArg.split('=')[1]) : 1;

  console.log('=== ソクミル APIクローラー（生データ保存対応） ===\n');
  console.log(`取得設定: page=${startPage}, per_page=${perPage}\n`);

  const sokmilClient = getSokmilClient();
  const db = getDb();

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    errors: 0,
    rawDataSaved: 0,
  };

  try {
    console.log('🔄 ソクミルAPIから新着作品を取得中...\n');

    // 新着作品を取得
    const response = await sokmilClient.getNewReleases(startPage, perPage);

    console.log(`✅ API取得完了: ${response.data.length}件 (総件数: ${response.totalCount})\n`);
    stats.totalFetched = response.data.length;

    for (const [index, item] of response.data.entries()) {
      try {
        console.log(`[${index + 1}/${response.data.length}] 処理中: ${item.itemName}`);

        // 商品データの検証
        const validation = validateProductData({
          title: item.itemName,
          description: item.description,
          aspName: 'ソクミル',
          originalId: item.itemId,
        });

        if (!validation.isValid) {
          console.log(`  ⚠️ スキップ: ${validation.reason}`);
          continue;
        }

        // 1. 生JSONレスポンスを保存
        const rawResponseResult = await db.execute(sql`
          INSERT INTO sokmil_raw_responses (item_id, api_type, raw_json, fetched_at)
          VALUES (${item.itemId}, 'item', ${JSON.stringify(item)}::jsonb, NOW())
          ON CONFLICT (item_id, api_type)
          DO UPDATE SET
            raw_json = EXCLUDED.raw_json,
            fetched_at = EXCLUDED.fetched_at,
            updated_at = NOW()
          RETURNING id
        `);

        const rawDataId = (rawResponseResult.rows[0] as any).id;
        stats.rawDataSaved++;

        console.log(`  ✓ 生データ保存完了 (raw_id: ${rawDataId})`);

        // 2. 正規化されたデータを保存
        // normalized_product_id生成: sokmil-{itemId}
        const normalizedProductId = `sokmil-${item.itemId}`;

        // productsテーブルにupsert
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
            ${item.itemName || ''},
            ${item.description || null},
            ${item.releaseDate || null},
            ${item.duration || null},
            ${item.thumbnailUrl || null},
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

        // 3. product_sourcesにupsert
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
            'ソクミル',
            ${item.itemId},
            ${item.affiliateUrl || item.itemUrl || ''},
            ${item.price || null},
            'API',
            NOW()
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        console.log(`  ✓ product_sources 保存完了`);

        // 4. product_raw_data_linksにリレーション作成
        await db.execute(sql`
          INSERT INTO product_raw_data_links (
            product_id,
            source_type,
            raw_data_id
          )
          VALUES (
            ${productId},
            'sokmil',
            ${rawDataId}
          )
          ON CONFLICT (product_id, source_type, raw_data_id)
          DO NOTHING
        `);

        console.log(`  ✓ リカバリーリンク作成完了`);

        // 5. サンプル画像を保存
        if (item.sampleImages && item.sampleImages.length > 0) {
          console.log(`  📷 サンプル画像保存中 (${item.sampleImages.length}枚)...`);

          // 既存の画像を削除
          await db.execute(sql`
            DELETE FROM product_images
            WHERE product_id = ${productId}
            AND asp_name = 'ソクミル'
            AND image_type = 'sample'
          `);

          // 新しい画像を挿入
          for (const [imgIndex, imageUrl] of item.sampleImages.entries()) {
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
                'ソクミル',
                ${imageUrl},
                'sample',
                ${imgIndex}
              )
            `);
          }

          console.log(`  ✓ サンプル画像保存完了`);
        }

        // 5.5. サンプル動画を保存
        // ソクミルクライアントが正規化したsampleVideoUrlを使用
        const sampleVideoUrl = item.sampleVideoUrl;

        if (sampleVideoUrl) {
          console.log(`  🎬 サンプル動画保存中...`);

          // 既存の動画を削除
          await db.execute(sql`
            DELETE FROM product_videos
            WHERE product_id = ${productId}
            AND asp_name = 'ソクミル'
          `);

          // 新しい動画を挿入
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
              'ソクミル',
              ${sampleVideoUrl},
              'sample',
              0
            )
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ サンプル動画保存完了`);
        }

        // 6. パッケージ画像を保存
        if (item.packageImageUrl) {
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
              'ソクミル',
              ${item.packageImageUrl},
              'package',
              0
            )
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ パッケージ画像保存完了`);
        }

        // 7. ジャンル（カテゴリ）保存
        if (item.genres && item.genres.length > 0) {
          console.log(`  🏷️  ジャンル保存中 (${item.genres.length}件)...`);

          for (const genre of item.genres) {
            // categoriesテーブルにupsert
            const categoryResult = await db.execute(sql`
              INSERT INTO categories (name)
              VALUES (${genre.name})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const categoryId = (categoryResult.rows[0] as any).id;

            // product_categoriesにリレーション作成
            await db.execute(sql`
              INSERT INTO product_categories (product_id, category_id)
              VALUES (${productId}, ${categoryId})
              ON CONFLICT DO NOTHING
            `);
          }

          console.log(`  ✓ ジャンル保存完了`);
        }

        // 8. 出演者情報保存
        if (item.actors && item.actors.length > 0) {
          console.log(`  👤 出演者保存中 (${item.actors.length}人)...`);

          for (const actor of item.actors) {
            // performersテーブルにupsert
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name)
              VALUES (${actor.name})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const performerId = (performerResult.rows[0] as any).id;

            // product_performersにリレーション作成
            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${productId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
          }

          console.log(`  ✓ 出演者保存完了`);
        }

        // 9. メーカー情報保存（将来の拡張用）
        if (item.maker) {
          console.log(`  🏢 メーカー情報: ${item.maker.name}`);
          // TODO: makersテーブルが実装されたら保存
        }

        // 10. レーベル情報保存（将来の拡張用）
        if (item.label) {
          console.log(`  🏷️  レーベル情報: ${item.label.name}`);
          // TODO: labelsテーブルが実装されたら保存
        }

        console.log();

        // API負荷軽減のため待機
        await new Promise(resolve => setTimeout(resolve, 500));

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
        (SELECT COUNT(*) FROM sokmil_raw_responses) as raw_data_count,
        (SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'sokmil-%') as product_count,
        (SELECT COUNT(*) FROM product_sources WHERE asp_name = 'ソクミル') as source_count,
        (SELECT COUNT(*) FROM product_raw_data_links WHERE source_type = 'sokmil') as link_count
    `);

    console.log('\nデータベース状態:');
    console.table(finalCounts.rows);

    console.log('\n次のページを取得する場合:');
    console.log(`npx tsx scripts/crawlers/crawl-sokmil-api.ts --page=${startPage + 1} --limit=${perPage}`);

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
