import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'performer_external_ids'
  `);
  console.log('performer_external_ids columns:');
  for (const r of cols.rows as any[]) console.log(' ', r.column_name);
  process.exit(0);
}
check().catch(e => {
  console.error(e);
  process.exit(1);
});
