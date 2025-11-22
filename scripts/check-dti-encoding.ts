/**
 * Check DTI encoding in database
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function check() {
  const db = getDb();

  // Check DTI products - using products table joined with product_sources
  const dtiProducts = await db.execute(sql`
    SELECT p.id, p.title, ps.asp_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
    ORDER BY p.created_at DESC
    LIMIT 10
  `);

  console.log('=== DTI Products in DB ===');
  for (const row of dtiProducts.rows) {
    console.log(`  [${row.id}] ${row.title}`);
  }

  // Total DTI count
  const totalCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`\nTotal DTI products: ${totalCount.rows[0].count}`);
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
