import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || '';
const url = new URL(connectionString);
const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: false,
  max: 2,
});

const db = drizzle(pool);

async function main() {
  // 各ASPごとにサンプル動画URLを確認
  const videoSamples = await db.execute(sql`
    SELECT
      ps.asp_name,
      pv.video_url,
      pv.video_type,
      pv.quality,
      p.title
    FROM product_videos pv
    JOIN products p ON p.id = pv.product_id
    JOIN product_sources ps ON ps.product_id = p.id
    WHERE pv.video_url IS NOT NULL
    GROUP BY ps.asp_name, pv.video_url, pv.video_type, pv.quality, p.title
    ORDER BY ps.asp_name
    LIMIT 20
  `);

  console.log('=== サンプル動画URL一覧（ASP別） ===');
  console.log(JSON.stringify(videoSamples.rows || videoSamples, null, 2));

  // ASPごとの動画数を集計
  const videoCounts = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT pv.product_id) as product_count,
      COUNT(*) as video_count
    FROM product_videos pv
    JOIN product_sources ps ON ps.product_id = pv.product_id
    GROUP BY ps.asp_name
    ORDER BY video_count DESC
  `);

  console.log('\n=== ASPごとの動画保有数 ===');
  console.log(JSON.stringify(videoCounts.rows || videoCounts, null, 2));

  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
