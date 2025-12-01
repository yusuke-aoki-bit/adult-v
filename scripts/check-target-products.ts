import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  const db = getDb();

  // 商品178179と285543の出演者情報
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      ps.asp_name,
      ps.original_product_id,
      STRING_AGG(perf.name, ', ') as performers
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers perf ON pp.performer_id = perf.id
    WHERE p.id IN (178179, 285543)
    GROUP BY p.id, p.title, ps.asp_name, ps.original_product_id
  `);

  console.log('=== 対象商品の出演者情報 ===');
  for (const row of result.rows as any[]) {
    console.log(`\nID: ${row.id}`);
    console.log(`Title: ${row.title}`);
    console.log(`ASP: ${row.asp_name} / ${row.original_product_id}`);
    console.log(`Performers: ${row.performers || '(なし)'}`);
  }

  // raw_html_dataから該当商品を確認
  console.log('\n\n=== raw_html_data確認 ===');
  const rawData = await db.execute(sql`
    SELECT rhd.source, rhd.product_id, LENGTH(rhd.html_content) as html_len
    FROM raw_html_data rhd
    INNER JOIN product_sources ps ON ps.original_product_id = rhd.product_id
    WHERE ps.product_id IN (178179, 285543)
  `);
  console.table(rawData.rows);

  process.exit(0);
}
check().catch((e) => {
  console.error(e);
  process.exit(1);
});
