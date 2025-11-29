import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  const videoStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT product_id) as products_with_videos
    FROM product_videos
  `);
  console.log('=== サンプル動画データ ===');
  console.table(videoStats.rows);

  const videoSamples = await db.execute(sql`
    SELECT product_id, video_url, video_type, quality
    FROM product_videos
    LIMIT 5
  `);
  console.log('サンプル:');
  console.table(videoSamples.rows);

  process.exit(0);
}

main().catch(console.error);
