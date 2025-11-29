import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== ASP別商品数 (product_sourcesより) ===');
  const aspStats = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(aspStats.rows);

  console.log('\n=== Siteタグ ===');
  const siteTags = await db.execute(sql`
    SELECT id, name, category
    FROM tags
    WHERE category = 'site'
    ORDER BY name
  `);
  console.table(siteTags.rows);

  process.exit(0);
}

main().catch(console.error);
