import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkPerformersColumns() {
  const db = getDb();

  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'performers'
      ORDER BY ordinal_position
    `);
    console.log('Performers table columns:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkPerformersColumns();
