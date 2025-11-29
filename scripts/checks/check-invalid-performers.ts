import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkInvalidPerformers() {
  console.log('=== 不正な出演者名チェック ===\n');

  // 短い名前や不正な文字を含む出演者
  const invalidPerformers = await db.execute(sql`
    SELECT id, name, name_kana, name_en,
           (SELECT COUNT(*) FROM product_performers WHERE performer_id = performers.id) as product_count
    FROM performers
    WHERE LENGTH(name) <= 2 OR name LIKE '%→%' OR name = 'デ' OR name = 'ラ' OR name LIKE '%ゆ→な%'
    ORDER BY product_count DESC, name
    LIMIT 100
  `);

  console.log(`見つかった不正データ: ${invalidPerformers.rows.length}件\n`);
  console.table(invalidPerformers.rows);

  process.exit(0);
}

checkInvalidPerformers().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
