import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== データベース統計 ===\n');
  console.log('更新日時:', new Date().toISOString().slice(0, 10));

  // 総商品数
  const products = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
  console.log('\n総商品数:', products.rows[0].count);

  // ASP別商品数（product_sourcesテーブルから）
  const aspStats = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('\nASP別商品数:');
  for (const r of aspStats.rows) {
    console.log(`  ${r.asp_name}: ${r.count}`);
  }

  // product_videos統計
  const videos = await db.execute(sql`SELECT COUNT(*) as count FROM product_videos`);
  console.log('\n総動画数:', videos.rows[0].count);

  // ASP別動画数
  const videoByAsp = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  if (videoByAsp.rows.length > 0) {
    console.log('\nASP別動画数:');
    for (const r of videoByAsp.rows) {
      console.log(`  ${r.asp_name}: ${r.count}`);
    }
  }

  // 演者数
  const performers = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
  console.log('\n総演者数:', performers.rows[0].count);

  // 画像数
  const images = await db.execute(sql`SELECT COUNT(*) as count FROM product_images`);
  console.log('総画像数:', images.rows[0].count);

  // 画像タイプ別
  const imageTypes = await db.execute(sql`
    SELECT image_type, COUNT(*) as count
    FROM product_images
    GROUP BY image_type
    ORDER BY count DESC
  `);
  console.log('\n画像タイプ別:');
  for (const r of imageTypes.rows) {
    console.log(`  ${r.image_type}: ${r.count}`);
  }

  // raw_html_data統計
  const rawHtml = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('\nraw_html_data (ソース別):');
  for (const r of rawHtml.rows) {
    console.log(`  ${r.source}: ${r.count}`);
  }

  // mgs_raw_pages統計
  const mgsRaw = await db.execute(sql`SELECT COUNT(*) as count FROM mgs_raw_pages`);
  console.log('\nmgs_raw_pages:', mgsRaw.rows[0].count);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
