/**
 * フロントエンド用データ確認スクリプト
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== DB Stats ===');
  const stats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM product_sources) as sources,
      (SELECT COUNT(*) FROM product_images) as images
  `);
  console.log(stats.rows[0]);

  console.log('\n=== ASP Stats ===');
  const asp = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  for (const row of asp.rows) {
    console.log(`${(row as any).asp_name}: ${(row as any).count}`);
  }

  console.log('\n=== Latest Products Sample ===');
  const sample = await db.execute(sql`
    SELECT
      p.id,
      LEFT(p.title, 30) as title,
      p.default_thumbnail_url IS NOT NULL as has_thumb,
      ps.asp_name,
      ps.affiliate_url IS NOT NULL as has_url,
      ps.price
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    ORDER BY p.created_at DESC
    LIMIT 5
  `);
  console.table(sample.rows);

  console.log('\n=== Products without sources ===');
  const noSource = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.id IS NULL
  `);
  console.log('Products without sources:', (noSource.rows[0] as any).count);

  console.log('\n=== Products without thumbnail ===');
  const noThumb = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products
    WHERE default_thumbnail_url IS NULL
  `);
  console.log('Products without thumbnail:', (noThumb.rows[0] as any).count);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
