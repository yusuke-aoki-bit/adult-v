import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * DUGA商品の product_sources と product_images を復元するスクリプト
 *
 * 問題: productsテーブルにはDUGA商品が存在するが、
 *      product_sourcesとproduct_imagesテーブルにデータがない
 *
 * 解決: productsテーブルのデータから、
 *      product_sourcesとproduct_imagesを生成する
 */

async function main() {
  const db = getDb();

  console.log('=== DUGA product_sources/product_images 復元スクリプト ===\n');

  // DUGA商品を取得
  const dugaProducts = await db.execute(sql`
    SELECT
      id,
      normalized_product_id,
      title,
      default_thumbnail_url
    FROM products
    WHERE normalized_product_id LIKE 'alpha-%'
    ORDER BY id
  `);

  console.log(`対象商品数: ${dugaProducts.rows.length}件\n`);

  let sourcesCreated = 0;
  let imagesCreated = 0;

  for (const product of dugaProducts.rows as any[]) {
    const productId = product.id;
    const normalizedProductId = product.normalized_product_id;
    const thumbnailUrl = product.default_thumbnail_url;

    console.log(`[${productId}] ${product.title} (${normalizedProductId})`);

    // original_product_idを抽出 (alpha-0272 → alpha/0272)
    const originalProductId = normalizedProductId.replace('-', '/');

    // affiliate_urlを生成
    const affiliateUrl = `https://click.duga.jp/ppv/${originalProductId}/48611-01`;

    // 1. product_sourcesにデータを挿入
    try {
      await db.execute(sql`
        INSERT INTO product_sources (
          product_id,
          asp_name,
          original_product_id,
          affiliate_url,
          data_source,
          last_updated
        )
        VALUES (
          ${productId},
          'DUGA',
          ${originalProductId},
          ${affiliateUrl},
          'backfill',
          NOW()
        )
        ON CONFLICT (product_id, asp_name)
        DO NOTHING
      `);
      sourcesCreated++;
      console.log(`  ✓ product_sources作成`);
    } catch (error) {
      console.error(`  ❌ product_sourcesエラー:`, error);
    }

    // 2. product_imagesにサムネイル画像を挿入
    if (thumbnailUrl) {
      try {
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
            ${thumbnailUrl},
            'package',
            0
          )
          ON CONFLICT DO NOTHING
        `);
        imagesCreated++;
        console.log(`  ✓ product_images作成`);
      } catch (error) {
        console.error(`  ❌ product_imagesエラー:`, error);
      }
    }

    console.log();
  }

  console.log('\n=== 復元完了 ===\n');
  console.log(`product_sources作成: ${sourcesCreated}件`);
  console.log(`product_images作成: ${imagesCreated}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
