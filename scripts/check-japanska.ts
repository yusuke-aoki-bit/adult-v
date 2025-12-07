import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  const db = getDb();

  // japanskaのデータ確認
  const result = await db.execute(sql`
    SELECT asp_name, COUNT(*) as cnt, MAX(last_updated) as last_update
    FROM product_sources
    WHERE asp_name ILIKE '%japanska%'
    GROUP BY asp_name
  `);

  console.log('=== japanska in product_sources ===');
  if (result.rows.length === 0) {
    console.log('No japanska data found');
  } else {
    for (const row of result.rows) {
      console.log(row);
    }
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
