import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // ASP別の商品数を確認
  const aspCounts = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('ASP別商品数:');
  console.table(aspCounts.rows);

  // DUGA商品のサンプルを確認
  const dugaSample = await db.execute(sql`
    SELECT original_product_id, price
    FROM product_sources
    WHERE asp_name = 'DUGA'
    LIMIT 5
  `);

  console.log('\nDUGA商品サンプル:');
  console.table(dugaSample.rows);

  // SOKMILとMGSも確認
  const sokmilSample = await db.execute(sql`
    SELECT original_product_id, price
    FROM product_sources
    WHERE asp_name = 'SOKMIL'
    LIMIT 3
  `);

  console.log('\nSOKMIL商品サンプル:');
  console.table(sokmilSample.rows);

  const mgsSample = await db.execute(sql`
    SELECT original_product_id, price
    FROM product_sources
    WHERE asp_name = 'MGS'
    LIMIT 3
  `);

  console.log('\nMGS商品サンプル:');
  console.table(mgsSample.rows);

  process.exit(0);
}

main().catch(console.error);
