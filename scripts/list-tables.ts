import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function listTables() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log('Available tables:');
  console.log(JSON.stringify(result.rows, null, 2));

  process.exit(0);
}

listTables();
