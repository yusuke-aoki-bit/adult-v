import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // 更新対象の商品IDを確認
  const targets = await db.execute(sql`
    SELECT ps.original_product_id, p.title
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    AND (p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%')
    ORDER BY ps.original_product_id::int
    LIMIT 20
  `);
  console.log('更新対象ID (先頭20件):');
  console.table(targets.rows);

  // ID範囲を確認
  const range = await db.execute(sql`
    SELECT
      MIN(original_product_id::int) as min_id,
      MAX(original_product_id::int) as max_id
    FROM product_sources
    WHERE asp_name = 'Japanska'
  `);
  console.log('\nID範囲:');
  console.table(range.rows);

  process.exit(0);
}

main().catch(console.error);
