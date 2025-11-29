import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // Japanska商品の演者紐付け状況を確認
  const japanskaStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(DISTINCT product_id) FROM product_sources WHERE asp_name = 'Japanska') as total_products,
      (SELECT COUNT(DISTINCT pp.product_id)
       FROM product_performers pp
       JOIN product_sources ps ON pp.product_id = ps.product_id
       WHERE ps.asp_name = 'Japanska') as products_with_performers
  `);
  console.log('=== Japanska演者紐付け状況 ===');
  console.table(japanskaStats.rows);

  // サンプル商品のタイトルを確認
  const sampleProducts = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    LIMIT 5
  `);
  console.log('\n=== Japanskaサンプル商品 ===');
  console.table(sampleProducts.rows);

  // raw_html_dataの確認
  const rawData = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    WHERE source ILIKE '%japanska%'
    GROUP BY source
  `);
  console.log('\n=== raw_html_data (Japanska) ===');
  console.table(rawData.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
