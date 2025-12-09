import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('Checking performers with spaces...');

  // 半角・全角スペースを含む名前を検索
  const result = await db.execute(sql`
    SELECT id, name FROM performers
    WHERE name LIKE '% %' OR name LIKE '%　%'
    ORDER BY id
    LIMIT 30
  `);

  console.log('スペースを含む演者名:', result.rows.length, '件');

  for (const row of result.rows as any[]) {
    console.log('  [' + row.id + '] "' + row.name + '"');
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
