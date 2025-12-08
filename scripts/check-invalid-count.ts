import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE title = 'お探しの商品が見つかりませんでした'
  `);
  console.log('残りの無効レコード数:', result.rows[0].count);

  const total = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
  console.log('総商品数:', total.rows[0].count);

  process.exit(0);
}
check();
