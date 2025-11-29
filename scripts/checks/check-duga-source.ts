import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // raw_csv_data sources
  const rawCsv = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_csv_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('=== raw_csv_data sources ===');
  console.table(rawCsv.rows);

  // DUGA data_source in product_sources
  const dugaSource = await db.execute(sql`
    SELECT data_source, COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'DUGA'
    GROUP BY data_source
  `);
  console.log('\n=== DUGA data_source ===');
  console.table(dugaSource.rows);

  // DUGAの最新データを確認
  const latestDuga = await db.execute(sql`
    SELECT ps.original_product_id, ps.data_source, ps.created_at
    FROM product_sources ps
    WHERE ps.asp_name = 'DUGA'
    ORDER BY ps.created_at DESC
    LIMIT 5
  `);
  console.log('\n=== Latest DUGA products ===');
  console.table(latestDuga.rows);

  process.exit(0);
}

main();
