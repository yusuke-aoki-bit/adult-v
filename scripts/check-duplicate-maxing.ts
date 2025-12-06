import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // maxing-2194の重複状況を確認
  const result = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id, ps.asp_name, ps.original_product_id, ps.affiliate_url
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.normalized_product_id LIKE '%maxing-2194%'
       OR ps.original_product_id LIKE '%maxing-2194%'
    ORDER BY p.id
  `);

  console.log('=== maxing-2194 の重複状況 ===');
  for (const r of result.rows) {
    console.log('ID:', r.id);
    console.log('Title:', r.title);
    console.log('normalized_product_id:', r.normalized_product_id);
    console.log('asp_name:', r.asp_name);
    console.log('original_product_id:', r.original_product_id);
    console.log('---');
  }

  // performer 18878の作品一覧を確認
  console.log('\n=== performer 18878 の作品一覧 ===');
  const perfProducts = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id, ps.asp_name
    FROM products p
    INNER JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE pp.performer_id = 18878
    ORDER BY p.id
  `);

  for (const r of perfProducts.rows) {
    console.log('ID:', r.id, '| normalized:', r.normalized_product_id, '| asp:', r.asp_name);
  }

  process.exit(0);
}
main().catch(console.error);
