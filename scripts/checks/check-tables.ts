import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('categories', 'product_categories', 'performers', 'product_performers')
    ORDER BY table_name
  `);

  console.log('関連テーブル:');
  console.table(result.rows);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
