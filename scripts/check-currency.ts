import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkCurrency() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT asp_name, currency, COUNT(*)::int as cnt
    FROM product_sources
    GROUP BY asp_name, currency
    ORDER BY cnt DESC
  `);

  console.log('=== ASP別 通貨統計 ===');
  for (const row of result.rows) {
    const r = row as { asp_name: string; currency: string | null; cnt: number };
    console.log(`${r.asp_name}: ${r.currency || 'NULL'} (${r.cnt}件)`);
  }

  process.exit(0);
}

checkCurrency().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
