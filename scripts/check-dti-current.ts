/**
 * 現在のDTI商品の状況を確認
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function checkCurrent() {
  const db = getDb();

  console.log('=== Current DTI Products in DB ===\n');

  // DTI product_cache サンプル (最新20件)
  // product_cacheからproductsテーブルをJOINしてtitleを取得
  const products = await db.execute(sql`
    SELECT pc.id, p.title, pc.asp_name, pc.cached_at as created_at
    FROM product_cache pc
    JOIN products p ON pc.product_id = p.id
    WHERE pc.asp_name = 'DTI'
    ORDER BY pc.cached_at DESC
    LIMIT 20
  `);

  for (const row of products.rows) {
    console.log(`  [${row.id}] ${row.title}`);
  }

  console.log(`\nTotal shown: ${products.rows.length} products`);

  // 全体数
  const total = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_cache
    WHERE asp_name = 'DTI'
  `);

  console.log(`Total DTI products: ${total.rows[0].count}`);
}

checkCurrent()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
