import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込み
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { getDb } from '../apps/web/lib/db';
import { performers } from '../apps/web/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  const db = getDb();

  console.log('Checking performer data...');

  // 1. 総数確認
  const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
  console.log('Total performers:', countResult.rows[0]);

  // 2. ID 61646を検索
  const result = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(eq(performers.id, 61646))
    .limit(1);
  console.log('Performer 61646:', result);

  // 3. 最初の5件
  const first5 = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .limit(5);
  console.log('First 5:', first5);

  // 4. IDの範囲確認
  const idRange = await db.execute(sql`SELECT MIN(id) as min_id, MAX(id) as max_id FROM performers`);
  console.log('ID range:', idRange.rows[0]);

  // 5. 人気のある女優を取得（フォールバック用）
  const popularActresses = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.name NOT LIKE '%素人%'
      AND p.name NOT LIKE '%女子%'
      AND LENGTH(p.name) > 1
    GROUP BY p.id, p.name
    ORDER BY product_count DESC
    LIMIT 10
  `);
  console.log('Popular actresses for fallback:');
  popularActresses.rows.forEach((row: { id: number; name: string; product_count: string }) => {
    console.log(`  { id: ${row.id}, name: '${row.name}' }, // ${row.product_count} products`);
  });

  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
