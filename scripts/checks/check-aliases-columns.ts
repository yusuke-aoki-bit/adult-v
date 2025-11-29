import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkAliasesColumns() {
  const db = getDb();

  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'performer_aliases'
      ORDER BY ordinal_position
    `);
    console.log('performer_aliases table columns:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkAliasesColumns();
