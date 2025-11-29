import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function findProducts() {
  const db = getDb();

  // Find SIRO products
  const siro = await db.execute(sql`
    SELECT original_product_id FROM product_sources
    WHERE asp_name = 'MGS' AND original_product_id LIKE 'SIRO-%'
    LIMIT 5
  `);

  console.log('SIRO products:');
  siro.rows.forEach(row => console.log('  ', (row as any).original_product_id));

  // Find 300MIUM products
  const mium = await db.execute(sql`
    SELECT original_product_id FROM product_sources
    WHERE asp_name = 'MGS' AND original_product_id LIKE '300MIUM-%'
    LIMIT 5
  `);

  console.log('\n300MIUM products:');
  mium.rows.forEach(row => console.log('  ', (row as any).original_product_id));

  // Find 259LUXU products
  const luxu = await db.execute(sql`
    SELECT original_product_id FROM product_sources
    WHERE asp_name = 'MGS' AND original_product_id LIKE '259LUXU-%'
    LIMIT 5
  `);

  console.log('\n259LUXU products:');
  luxu.rows.forEach(row => console.log('  ', (row as any).original_product_id));
}

findProducts().then(() => process.exit(0));
