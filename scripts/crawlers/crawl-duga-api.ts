import { getDugaClient } from '../../lib/providers/duga-client';
import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import { validateProductData } from '../../lib/crawler-utils';

/**
 * DUGA API クローラー（生データ保存対応）
 *
 * 機能:
 * - DUGA APIから商品データを取得
 * - 生レスポンスをduga_raw_responsesテーブルに保存
 * - パースしたデータを正規化テーブル（products, product_sources等）に保存
 * - product_raw_data_linksでリレーション作成（リカバリー用）
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-duga-api.ts [--limit 100] [--offset 0]
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
  const offsetArg = args.find(arg => arg.startsWith('--offset='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

  console.log('=== DUGA APIクローラー（生データ保存対応） ===\n');
  console.log(`取得範囲: offset=${offset}, limit=${limit}\n`);

  const dugaClient = getDugaClient();
  const db = getDb();

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    errors: 0,
    rawDataSaved: 0,
  };

  try {
    console.log('🔄 DUGA APIから新着作品を取得中...\n');

    // 新着作品を取得
    const response = await dugaClient.getNewReleases(limit, offset);

    console.log(`✅ API取得完了: ${response.items.length}件\n`);
    stats.totalFetched = response.items.length;

    for (const [index, item] of response.items.entries()) {
      try {
        console.log(`[${index + 1}/${response.items.length}] 処理中: ${item.title}`);

        // 商品データの検証
        const validation = validateProductData({
          title: item.title,
          description: item.description,
          aspName: 'DUGA',
          originalId: item.productId,
        });

        if (!validation.isValid) {
          console.log(`  ⚠️ スキップ: ${validation.reason}`);
          continue;
        }

        // 1. 生JSONレスポンスを保存
        const rawResponseResult = await db.execute(sql`
          INSERT INTO duga_raw_responses (product_id, api_version, raw_json, fetched_at)
          VALUES (${item.productId}, '1.2', ${JSON.stringify(item)}::jsonb, NOW())
          ON CONFLICT (product_id)
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
        // normalized_product_id生成: DUGA-{productId}
        const normalizedProductId = `duga-${item.productId}`;

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
            ${item.title || ''},
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
            'DUGA',
            ${item.productId},
            ${item.affiliateUrl || ''},
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
            'duga',
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
            AND asp_name = 'DUGA'
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
                'DUGA',
                ${imageUrl},
                'sample',
                ${imgIndex}
              )
            `);
          }

          console.log(`  ✓ サンプル画像保存完了`);
        }

        // 5.5. サンプル動画を保存
        if (item.sampleVideos && item.sampleVideos.length > 0) {
          console.log(`  🎬 サンプル動画保存中 (${item.sampleVideos.length}件)...`);

          // 既存の動画を削除
          await db.execute(sql`
            DELETE FROM product_videos
            WHERE product_id = ${productId}
            AND asp_name = 'DUGA'
          `);

          // 新しい動画を挿入
          for (const [videoIndex, videoUrl] of item.sampleVideos.entries()) {
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
                'DUGA',
                ${videoUrl},
                'sample',
                ${videoIndex}
              )
            `);
          }

          console.log(`  ✓ サンプル動画保存完了`);
        }

        // 6. パッケージ画像を保存
        if (item.packageUrl) {
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
              'DUGA',
              ${item.packageUrl},
              'package',
              0
            )
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ パッケージ画像保存完了`);
        }

        // 7. カテゴリ・タグ保存（categoriesがある場合）
        if (item.categories && item.categories.length > 0) {
          console.log(`  🏷️  カテゴリ保存中 (${item.categories.length}件)...`);

          for (const category of item.categories) {
            // まずcategoriesテーブルにupsert
            const categoryResult = await db.execute(sql`
              INSERT INTO categories (name)
              VALUES (${category.name})
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

          console.log(`  ✓ カテゴリ保存完了`);
        }

        // 8. 出演者情報保存（performersがある場合）
        if (item.performers && item.performers.length > 0) {
          console.log(`  👤 出演者保存中 (${item.performers.length}人)...`);

          for (const performer of item.performers) {
            // performersテーブルにupsert
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name)
              VALUES (${performer.name})
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

        console.log();

        // レート制限対策: 1秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));

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
        (SELECT COUNT(*) FROM duga_raw_responses) as raw_data_count,
        (SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'duga-%') as product_count,
        (SELECT COUNT(*) FROM product_sources WHERE asp_name = 'DUGA') as source_count,
        (SELECT COUNT(*) FROM product_raw_data_links WHERE source_type = 'duga') as link_count
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
