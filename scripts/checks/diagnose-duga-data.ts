import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== DUGAデータ診断 ===\n');

  // DUGA商品の総数
  const dugaProducts = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM products
    WHERE normalized_product_id LIKE 'alpha-%'
  `);
  console.log('DUGA商品総数 (alpha-):', dugaProducts.rows[0]);

  // product_sourcesにデータがあるDUGA商品
  const withSources = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.normalized_product_id LIKE 'alpha-%'
  `);
  console.log('product_sourcesにデータがある:', withSources.rows[0]);

  // product_imagesにデータがあるDUGA商品
  const withImages = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_images pi ON p.id = pi.product_id
    WHERE p.normalized_product_id LIKE 'alpha-%'
  `);
  console.log('product_imagesにデータがある:', withImages.rows[0]);

  // サンプル: alpha-0272の詳細
  console.log('\n=== alpha-0272 (ID: 6620) の詳細 ===\n');

  const product = await db.execute(sql`
    SELECT id, normalized_product_id, title, default_thumbnail_url
    FROM products
    WHERE id = 6620
  `);
  console.log('商品情報:');
  console.table(product.rows);

  // raw_html_dataを確認
  const rawHtml = await db.execute(sql`
    SELECT id, product_id, source, fetched_at, LENGTH(html_data) as html_length
    FROM raw_html_data
    WHERE product_id = 'alpha/0272'
    LIMIT 1
  `);
  console.log('\n生HTMLデータ:');
  console.table(rawHtml.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
