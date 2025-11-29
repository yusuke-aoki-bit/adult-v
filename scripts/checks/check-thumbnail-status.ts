import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // 鈴村あいり (ID: 47856) の作品を確認
  const products = await db.execute(sql`
    SELECT p.id, p.title, p.default_thumbnail_url, ps.asp_name
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE pp.performer_id = 47856
    ORDER BY p.release_date DESC
    LIMIT 5
  `);
  console.log('=== 鈴村あいりの最新作品 ===');
  console.table(products.rows);

  // 一般的に products.default_thumbnail_url の状況
  const thumbStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(default_thumbnail_url) as with_thumbnail,
      COUNT(*) - COUNT(default_thumbnail_url) as without_thumbnail
    FROM products
  `);
  console.log('=== 商品のサムネイル状況 ===');
  console.table(thumbStats.rows);

  // ASP別サムネイル状況
  const aspThumbStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL THEN p.id END) as with_thumb
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);
  console.log('=== ASP別サムネイル状況 ===');
  console.table(aspThumbStats.rows);

  process.exit(0);
}

main();
