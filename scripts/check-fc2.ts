/**
 * FC2表示問題の調査スクリプト
 *
 * 使い方:
 *   DATABASE_URL="..." npx tsx scripts/check-fc2.ts
 */

import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // FC2商品の総数確認
    const fc2Count = await pool.query(`
      SELECT COUNT(DISTINCT ps.product_id) as count
      FROM product_sources ps
      WHERE LOWER(ps.asp_name) LIKE '%fc2%'
    `);
    console.log('FC2商品総数:', fc2Count.rows[0]?.count);

    // FC2のASP名バリエーション確認
    const fc2Names = await pool.query(`
      SELECT DISTINCT ps.asp_name, COUNT(*) as count
      FROM product_sources ps
      WHERE LOWER(ps.asp_name) LIKE '%fc2%'
      GROUP BY ps.asp_name
    `);
    console.log('FC2 ASP名:', fc2Names.rows);

    // 同じタイトルを持つ商品数
    const titleDups = await pool.query(`
      SELECT p.title, COUNT(*) as count
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE LOWER(ps.asp_name) LIKE '%fc2%'
      GROUP BY p.title
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('重複タイトル数:', titleDups.rows.length);
    if (titleDups.rows.length > 0) {
      console.log('重複例:', titleDups.rows.slice(0, 3));
    }

    // ユニークタイトル数
    const uniqueTitles = await pool.query(`
      SELECT COUNT(DISTINCT p.title) as count
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE LOWER(ps.asp_name) LIKE '%fc2%'
    `);
    console.log('ユニークタイトル数:', uniqueTitles.rows[0]?.count);

  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
