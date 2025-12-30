import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../packages/database/src/client';

async function main() {
  const result = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM wiki_crawl_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('wiki_crawl_data sources:');
  for (const row of result.rows as { source: string; count: string }[]) {
    console.log(`  ${row.source}: ${row.count}`);
  }
  await closeDb();
}

main().catch(console.error);
