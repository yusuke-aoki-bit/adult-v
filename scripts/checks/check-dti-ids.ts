import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // DTI商品のnormalized_product_idサンプルを確認
  const sample = await db.execute(sql`
    SELECT p.normalized_product_id, ps.original_product_id, p.title
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    ORDER BY p.id DESC
    LIMIT 20
  `);

  console.log('=== DTI商品サンプル ===');
  sample.rows.forEach((r: any) => console.log(`  ${r.normalized_product_id} | ${r.original_product_id}`));

  // DTI商品のサイト別分布
  const distribution = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE '一本道-%' THEN '一本道'
        WHEN p.normalized_product_id LIKE 'カリビアンコム-%' THEN 'カリビアンコム'
        WHEN p.normalized_product_id LIKE 'カリビアンコムプレミアム-%' THEN 'カリビアンコムプレミアム'
        WHEN p.normalized_product_id LIKE 'パコパコママ-%' THEN 'パコパコママ'
        WHEN p.normalized_product_id LIKE '天然むすめ-%' THEN '天然むすめ'
        WHEN p.normalized_product_id LIKE 'HEYZO-%' THEN 'HEYZO'
        ELSE 'その他'
      END as site_name,
      COUNT(*) as total
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'DTI'
    GROUP BY site_name
    ORDER BY total DESC
  `);

  console.log('\n=== DTI商品サイト別分布 ===');
  console.table(distribution.rows);

  process.exit(0);
}

main();
