import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // ソクミルの商品を確認
  const products = await db.execute(sql`
    SELECT p.title, ps.original_product_id, ps.affiliate_url
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'ソクミル'
    LIMIT 10
  `);

  console.log('=== ソクミル商品 ===');
  for (const row of products.rows as any[]) {
    console.log('ID:', row.original_product_id);
    console.log('  タイトル:', (row.title || '').substring(0, 60));
    console.log('');
  }

  // 総数と重複チェック
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT original_product_id) as unique_ids
    FROM product_sources
    WHERE asp_name = 'ソクミル'
  `);
  console.log('=== 統計 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
