import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT p.normalized_product_id, p.title, ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL AND ps.asp_name = 'MGS'
    ORDER BY p.id
    LIMIT 10
  `);
  result.rows.forEach((r: any) =>
    console.log(r.normalized_product_id, '|', r.original_product_id, '|', r.title?.substring(0, 60))
  );
  process.exit(0);
}
main();
