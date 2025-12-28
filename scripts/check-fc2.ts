import { db } from '../packages/database/src/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    // product_sourcesテーブルでFC2商品を確認（ASPフィルタはこちらを使用）
    const sourcesResult = await db.execute(sql`
      SELECT
        asp_name,
        COUNT(DISTINCT product_id) as product_count,
        COUNT(*) as source_count
      FROM product_sources
      WHERE asp_name ILIKE '%fc2%'
      GROUP BY asp_name
    `);
    console.log('FC2 in product_sources:', JSON.stringify(sourcesResult.rows, null, 2));

    // FC2商品のサンプル（product_sourcesとJOIN）
    const samples = await db.execute(sql`
      SELECT p.id, p.title, ps.asp_name, ps.original_product_id, p.release_date
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name ILIKE '%fc2%'
      ORDER BY p.release_date DESC NULLS LAST
      LIMIT 10
    `);
    console.log('FC2 sample products:', JSON.stringify(samples.rows, null, 2));

    // FC2のASP名のバリエーションを確認
    const aspNames = await db.execute(sql`
      SELECT DISTINCT asp_name FROM product_sources WHERE asp_name ILIKE '%fc2%'
    `);
    console.log('FC2 asp_name variations:', JSON.stringify(aspNames.rows, null, 2));

    // 全ASP名を確認
    const allAsps = await db.execute(sql`
      SELECT asp_name, COUNT(*) as count FROM product_sources GROUP BY asp_name ORDER BY count DESC
    `);
    console.log('All ASP names:', JSON.stringify(allAsps.rows, null, 2));

  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

check();
