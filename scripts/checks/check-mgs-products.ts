import { getDb } from '../lib/db';
import { productSources } from '../lib/db/schema';
import { sql, like } from 'drizzle-orm';

async function checkMgsProducts() {
  const db = getDb();

  // MGSを含むASP名を確認
  const result = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    WHERE asp_name LIKE '%MGS%'
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('MGS products by asp_name:');
  console.log(JSON.stringify(result.rows, null, 2));

  // 全ASP名を確認
  const allAsps = await db.execute(sql`
    SELECT DISTINCT asp_name
    FROM product_sources
    ORDER BY asp_name
  `);

  console.log('\n\nAll ASP names:');
  console.log(JSON.stringify(allAsps.rows, null, 2));
}

checkMgsProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
