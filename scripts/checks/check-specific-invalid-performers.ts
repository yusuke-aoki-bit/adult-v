import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkSpecificInvalidPerformers() {
  console.log('=== 「デ」「ラ」「→」を含む出演者 ===\n');

  // デ、ラ、→を含む出演者を検索
  const result = await db.execute(sql`
    SELECT id, name, name_kana, name_en,
           (SELECT COUNT(*) FROM product_performers WHERE performer_id = performers.id) as product_count
    FROM performers
    WHERE name = 'デ' OR name = 'ラ' OR name LIKE '%→%'
    ORDER BY product_count DESC
  `);

  console.log(`見つかった件数: ${result.rows.length}件\n`);
  console.table(result.rows);

  process.exit(0);
}

checkSpecificInvalidPerformers().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
