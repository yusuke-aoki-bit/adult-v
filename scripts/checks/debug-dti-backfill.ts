import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // バックフィルで取得される商品を確認
  const products = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.normalized_product_id
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'DTI'
    AND pp.product_id IS NULL
    AND (
      p.normalized_product_id LIKE '一本道-%'
      OR p.normalized_product_id LIKE 'カリビアンコム-%'
      OR p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
      OR p.normalized_product_id LIKE 'パコパコママ-%'
      OR p.normalized_product_id LIKE '天然むすめ-%'
      OR p.normalized_product_id LIKE 'HEYZO-%'
    )
    ORDER BY ps.product_id DESC
    LIMIT 20
  `);

  console.log(`取得件数: ${products.rows.length}`);
  console.log('\n=== サンプル ===');
  for (const row of products.rows as any[]) {
    console.log(`  ${row.normalized_product_id}`);
  }

  // サイト別分布
  const dist = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE '一本道-%' THEN '一本道'
        WHEN p.normalized_product_id LIKE 'カリビアンコムプレミアム-%' THEN 'カリビアンコムPR'
        WHEN p.normalized_product_id LIKE 'カリビアンコム-%' THEN 'カリビアンコム'
        WHEN p.normalized_product_id LIKE 'パコパコママ-%' THEN 'パコパコママ'
        WHEN p.normalized_product_id LIKE '天然むすめ-%' THEN '天然むすめ'
        WHEN p.normalized_product_id LIKE 'HEYZO-%' THEN 'HEYZO'
        ELSE 'その他'
      END as site,
      COUNT(*) as cnt
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'DTI'
    AND pp.product_id IS NULL
    AND (
      p.normalized_product_id LIKE '一本道-%'
      OR p.normalized_product_id LIKE 'カリビアンコム-%'
      OR p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
      OR p.normalized_product_id LIKE 'パコパコママ-%'
      OR p.normalized_product_id LIKE '天然むすめ-%'
      OR p.normalized_product_id LIKE 'HEYZO-%'
    )
    GROUP BY site
    ORDER BY cnt DESC
  `);

  console.log('\n=== 未紐付きサイト別分布 ===');
  console.table(dist.rows);

  process.exit(0);
}

main();
