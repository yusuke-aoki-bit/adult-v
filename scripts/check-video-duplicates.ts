import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
  const duplicates = await db.execute(sql`
    SELECT product_id, video_url, COUNT(*) as cnt
    FROM product_videos
    GROUP BY product_id, video_url
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  console.log('重複している動画:');
  console.log(JSON.stringify(duplicates.rows, null, 2));

  const totalDups = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT product_id, video_url
      FROM product_videos
      GROUP BY product_id, video_url
      HAVING COUNT(*) > 1
    ) t
  `);
  console.log('\n重複ペア総数:', totalDups.rows[0].count);

  const total = await db.execute(sql`SELECT COUNT(*) as count FROM product_videos`);
  console.log('product_videos 総件数:', total.rows[0].count);

  process.exit(0);
}

checkDuplicates();
