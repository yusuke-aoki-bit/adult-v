import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // 古い商品を取得（release_dateが古い順）
  const oldProducts = await db.execute(sql`
    SELECT ps.original_product_id, p.title, p.release_date
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS' AND ps.product_type = 'haishin'
    AND p.release_date IS NOT NULL
    ORDER BY p.release_date ASC
    LIMIT 10
  `);

  console.log('=== 最も古いMGS商品（リリース日順） ===\n');
  for (const r of oldProducts.rows) {
    console.log(`${r.original_product_id}`);
    console.log(`  URL: https://www.mgstage.com/product/product_detail/${r.original_product_id}/`);
    console.log(`  Release: ${r.release_date}`);
    console.log(`  Title: ${(r.title as string).slice(0, 50)}...`);
    console.log();
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
