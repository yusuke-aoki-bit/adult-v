/**
 * 女優と商品の紐づき状況を確認するスクリプト
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const performerName = process.argv[2] || '東条蒼';

  // 女優情報を取得
  const performer = await db.execute(sql`
    SELECT id, name, name_kana, release_count
    FROM performers
    WHERE name LIKE ${'%' + performerName + '%'}
    LIMIT 5
  `);
  console.log('=== 女優情報 ===');
  console.log(performer.rows);

  if (performer.rows.length > 0) {
    const performerId = (performer.rows[0] as { id: number }).id;

    // その女優に紐づく商品数
    const productCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM product_performers pp
      WHERE pp.performer_id = ${performerId}
    `);
    console.log('\n=== 紐づき商品数 ===');
    console.log(productCount.rows);

    // ASP別の商品数
    const aspCounts = await db.execute(sql`
      SELECT ps.asp_name, COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${performerId}
      GROUP BY ps.asp_name
      ORDER BY count DESC
    `);
    console.log('\n=== ASP別商品数 ===');
    console.log(aspCounts.rows);

    // サンプル商品
    const sampleProducts = await db.execute(sql`
      SELECT p.id, p.title, p.normalized_product_id, ps.asp_name
      FROM products p
      JOIN product_performers pp ON p.id = pp.product_id
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${performerId}
      ORDER BY p.id DESC
      LIMIT 10
    `);
    console.log('\n=== サンプル商品 ===');
    console.log(sampleProducts.rows);
  }

  // 女優なしの商品数（FANZA/MGS）
  const noPerformerCount = await db.execute(sql`
    SELECT ps.asp_name, COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
      AND ps.asp_name IN ('FANZA', 'MGS')
    GROUP BY ps.asp_name
  `);
  console.log('\n=== 女優なし商品数（FANZA/MGS） ===');
  console.log(noPerformerCount.rows);

  // 全体の統計
  const totalStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as total_products,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN p.id END) as with_performer,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN p.id END) / COUNT(DISTINCT p.id), 1) as percentage
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE ps.asp_name IN ('FANZA', 'MGS', 'DUGA', 'SOKMIL')
    GROUP BY ps.asp_name
    ORDER BY total_products DESC
  `);
  console.log('\n=== ASP別 女優紐づき率 ===');
  console.log(totalStats.rows);

  await pool.end();
}

main().catch(console.error);
