import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function examineRawCsv() {
  const db = getDb();

  console.log('=== Examining raw_csv_data ===\n');

  const sample = await db.execute(sql`
    SELECT product_code, LEFT(csv_content, 1000) as csv_preview
    FROM raw_csv_data
    LIMIT 3
  `);

  for (const row of sample.rows) {
    const data = row as any;
    console.log(`Product Code: ${data.product_code}`);
    console.log(`CSV Preview:\n${data.csv_preview}\n`);
    console.log('---\n');
  }

  process.exit(0);
}

examineRawCsv();
