import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  // DTI系の価格データを確認
  const results = await db.execute(sql`
    SELECT
      ps.asp_name,
      ps.original_product_id,
      ps.price,
      ps.affiliate_url,
      p.title
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'dti'
    ORDER BY ps.id DESC
    LIMIT 20
  `);

  console.log('=== DTI系の価格データサンプル ===');
  for (const row of results.rows as any[]) {
    console.log(`価格: ${row.price} | ID: ${row.original_product_id}`);
    console.log(`  タイトル: ${row.title?.substring(0, 50)}...`);
    console.log(`  URL: ${row.affiliate_url?.substring(0, 100)}...`);
    console.log('');
  }
}

check().catch(console.error);
