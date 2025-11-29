import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkMgsProductIds() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT original_product_id
    FROM product_sources
    WHERE asp_name = 'MGS'
    AND (
      original_product_id LIKE 'STARS%'
      OR original_product_id LIKE '107STARS%'
      OR original_product_id LIKE 'ABW%'
      OR original_product_id LIKE '300MIUM%'
      OR original_product_id LIKE 'MFCS%'
      OR original_product_id LIKE '812MMC%'
      OR original_product_id LIKE 'DDH%'
    )
    LIMIT 20
  `);

  console.log('=== MGS Product IDs in Database ===');
  console.table(result.rows);
}

checkMgsProductIds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
