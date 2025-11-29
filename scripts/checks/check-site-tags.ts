import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkSiteTags() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT id, name, category
    FROM tags
    WHERE category = 'site'
    ORDER BY name
  `);

  console.log('Site tags in database:');
  console.log(JSON.stringify(result.rows, null, 2));
}

checkSiteTags().then(() => process.exit(0));
