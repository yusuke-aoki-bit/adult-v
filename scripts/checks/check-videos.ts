import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  const videoStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('=== サンプル動画保存状況 (product_videos) ===');
  console.table(videoStats.rows);

  const total = await db.execute(sql`SELECT COUNT(*) as total FROM product_videos`);
  console.log('総動画数:', total.rows[0]);

  process.exit(0);
}

main();
