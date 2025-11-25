/**
 * Check DTI product counts before archival
 */
import { getDb } from '../lib/db';
import { products, productSources } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // DTI sites list (based on DMM affiliate terms)
  const dtiSites = ['HEYZO', 'CARIB', '1PONDO', 'CARIBPR'];

  console.log('DTI系商品数の確認:\n');

  for (const site of dtiSites) {
    const count = await db.execute(sql`
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name LIKE '%' || ${site} || '%'
    `);

    console.log(`  ${site}: ${count.rows[0].count}件`);
  }

  // Total DTI products (any product with DTI sources)
  const totalDti = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name LIKE '%HEYZO%'
       OR ps.asp_name LIKE '%CARIB%'
       OR ps.asp_name LIKE '%1PONDO%'
       OR ps.asp_name = 'DTI'
  `);

  console.log(`\n合計DTI系商品: ${totalDti.rows[0].count}件`);

  // Sample DTI asp_name values
  console.log('\nサンプルDTI asp_name:');
  const samples = await db.execute(sql`
    SELECT DISTINCT ps.asp_name
    FROM product_sources ps
    WHERE ps.asp_name LIKE '%HEYZO%'
       OR ps.asp_name LIKE '%CARIB%'
       OR ps.asp_name LIKE '%1PONDO%'
       OR ps.asp_name = 'DTI'
    LIMIT 20
  `);

  samples.rows.forEach((row: any) => console.log(`  - ${row.asp_name}`));

  // Total all products
  const totalAll = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  console.log(`\n全商品数: ${totalAll[0].count}件`);
  console.log(`非DTI商品数: ${Number(totalAll[0].count) - Number(totalDti.rows[0].count)}件`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
