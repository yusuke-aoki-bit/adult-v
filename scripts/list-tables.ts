import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function listTables() {
  const result = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log('Available tables:');
  for (const r of result.rows) {
    console.log(`  ${r.tablename}`);
  }

  process.exit(0);
}

listTables();
