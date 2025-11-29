import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkTsConfig() {
  const db = getDb();

  try {
    const result = await db.execute(sql`SELECT cfgname FROM pg_ts_config ORDER BY cfgname`);
    console.log('Available text search configurations:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkTsConfig();
