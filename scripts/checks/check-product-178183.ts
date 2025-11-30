import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  const product = await db.execute(sql`
    SELECT p.id, p.title, p.description, p.default_thumbnail_url, ps.asp_name, ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.id = 178183
  `);

  console.log('=== 商品詳細 ===');
  const row = product.rows[0] as any;
  console.log('ID:', row?.id);
  console.log('Title:', row?.title);
  console.log('ASP:', row?.asp_name);
  console.log('Original ID:', row?.original_product_id);
  console.log('Description:', row?.description?.substring(0, 500));

  // 出演者紐付け確認
  const performers = await db.execute(sql`
    SELECT pe.id, pe.name FROM product_performers pp
    JOIN performers pe ON pp.performer_id = pe.id
    WHERE pp.product_id = 178183
  `);

  console.log('\n=== 紐付け済み出演者 ===');
  if (performers.rows.length > 0) {
    console.table(performers.rows);
  } else {
    console.log('(なし)');
  }

  process.exit(0);
}

main();
