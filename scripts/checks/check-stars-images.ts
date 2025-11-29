import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkStarsImages() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT ps.original_product_id, p.default_thumbnail_url
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'MGS'
    AND ps.original_product_id LIKE 'STARS%'
    AND p.default_thumbnail_url IS NOT NULL
    AND p.default_thumbnail_url != ''
    LIMIT 5
  `);

  console.log(JSON.stringify(result.rows, null, 2));
}

checkStarsImages().then(() => process.exit(0));
