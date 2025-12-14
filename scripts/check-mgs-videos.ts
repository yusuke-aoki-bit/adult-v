import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS動画データ確認 ===\n');

  // MGSの動画データを確認
  const mgsVideos = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_videos WHERE asp_name = 'MGS'
  `);
  console.log('MGS動画数:', mgsVideos.rows[0].count);

  // MGSの商品数を確認
  const mgsProducts = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count FROM product_sources WHERE asp_name = 'MGS'
  `);
  console.log('MGS商品数:', mgsProducts.rows[0].count);

  // 最近のMGS商品のサンプル動画URL有無を確認
  const recentMgs = await db.execute(sql`
    SELECT p.id, p.title,
      (SELECT COUNT(*) FROM product_videos pv WHERE pv.product_id = p.id) as video_count
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    ORDER BY p.created_at DESC
    LIMIT 10
  `);
  console.log('\n最近のMGS商品の動画数:');
  for (const r of recentMgs.rows) {
    const title = (r.title as string)?.slice(0, 40) || '';
    console.log(`  ID:${r.id} videos:${r.video_count} - ${title}...`);
  }

  // MGSクローラーの動画保存コードを確認するための情報
  console.log('\n=== MGSクローラー実装確認 ===');

  // raw_html_dataからMGSのサンプルを取得
  const mgsRawSample = await db.execute(sql`
    SELECT product_id,
      CASE WHEN html_content IS NOT NULL THEN 'has_html' ELSE 'no_html' END as html_status
    FROM raw_html_data
    WHERE source = 'MGS'
    LIMIT 5
  `);
  console.log('\nMGS raw_html_data サンプル:');
  for (const r of mgsRawSample.rows) {
    console.log(`  ${r.product_id}: ${r.html_status}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
