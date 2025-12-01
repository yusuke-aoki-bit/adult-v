import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function cleanup() {
  const db = getDb();

  // 「まるっと！木下ひまり」のリンクを削除
  await db.execute(sql`
    DELETE FROM product_performers
    WHERE product_id = 285543
      AND performer_id = (SELECT id FROM performers WHERE name = 'まるっと！木下ひまり')
  `);
  console.log('Removed invalid performer link');

  // 確認
  const result = await db.execute(sql`
    SELECT p.id, STRING_AGG(perf.name, ', ') as performers
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers perf ON pp.performer_id = perf.id
    WHERE p.id = 285543
    GROUP BY p.id
  `);
  console.log('Result:', result.rows[0]);

  process.exit(0);
}
cleanup();
