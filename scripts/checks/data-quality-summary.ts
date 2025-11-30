import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== データ品質サマリー ===\n');

  // 動画情報
  const videoStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM product_videos) as total_videos,
      (SELECT COUNT(DISTINCT product_id) FROM product_videos) as products_with_video,
      (SELECT COUNT(*) FROM products) as total_products
  `);
  const vRow = videoStats.rows[0] as any;
  console.log('【サンプル動画】');
  console.log('  総動画数:', vRow.total_videos);
  console.log('  動画あり商品数:', vRow.products_with_video);
  console.log('  全商品数:', vRow.total_products);
  console.log('  動画カバー率:', (Number(vRow.products_with_video) / Number(vRow.total_products) * 100).toFixed(1) + '%');

  // ASP別動画数
  const videoByAsp = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('\n  ASP別動画数:');
  console.table(videoByAsp.rows);

  // 画像情報
  const imageStats = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' THEN 1 END) as with_thumb,
      COUNT(CASE WHEN default_thumbnail_url IS NULL OR default_thumbnail_url = '' THEN 1 END) as no_thumb,
      COUNT(*) as total
    FROM products
  `);
  const iRow = imageStats.rows[0] as any;
  console.log('\n【サムネイル画像】');
  console.log('  サムネあり:', iRow.with_thumb);
  console.log('  サムネなし:', iRow.no_thumb);
  console.log('  カバー率:', (Number(iRow.with_thumb) / Number(iRow.total) * 100).toFixed(1) + '%');

  // ASP別サムネなし
  const noThumbByAsp = await db.execute(sql`
    SELECT ps.asp_name, COUNT(DISTINCT p.id) as no_thumb_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = ''
    GROUP BY ps.asp_name
    ORDER BY no_thumb_count DESC
  `);
  console.log('\n  サムネなし商品（ASP別）:');
  console.table(noThumbByAsp.rows);

  // 出演者情報
  const performerStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM performers) as total_performers,
      (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as linked_performers,
      (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performer,
      (SELECT COUNT(*) FROM products) as total_products
  `);
  const pRow = performerStats.rows[0] as any;
  console.log('\n【出演者情報】');
  console.log('  総女優数:', pRow.total_performers);
  console.log('  作品紐付済み女優:', pRow.linked_performers);
  console.log('  出演者紐付済み商品:', pRow.products_with_performer);
  console.log('  出演者カバー率:', (Number(pRow.products_with_performer) / Number(pRow.total_products) * 100).toFixed(1) + '%');

  // ASP別出演者なし
  const noPerfByAsp = await db.execute(sql`
    SELECT ps.asp_name, COUNT(DISTINCT ps.product_id) as no_perf_count
    FROM product_sources ps
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.product_id = ps.product_id
    )
    GROUP BY ps.asp_name
    ORDER BY no_perf_count DESC
  `);
  console.log('\n  出演者なし商品（ASP別）:');
  console.table(noPerfByAsp.rows);

  // リリース日
  const releaseDateStats = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN release_date IS NOT NULL THEN 1 END) as with_date,
      COUNT(CASE WHEN release_date IS NULL THEN 1 END) as no_date,
      COUNT(*) as total
    FROM products
  `);
  const rRow = releaseDateStats.rows[0] as any;
  console.log('\n【リリース日】');
  console.log('  リリース日あり:', rRow.with_date);
  console.log('  リリース日なし:', rRow.no_date);
  console.log('  カバー率:', (Number(rRow.with_date) / Number(rRow.total) * 100).toFixed(1) + '%');

  // ASP別リリース日なし
  const noDateByAsp = await db.execute(sql`
    SELECT ps.asp_name, COUNT(DISTINCT p.id) as no_date_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.release_date IS NULL
    GROUP BY ps.asp_name
    ORDER BY no_date_count DESC
  `);
  console.log('\n  リリース日なし商品（ASP別）:');
  console.table(noDateByAsp.rows);

  // ASP別商品数
  const aspCounts = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('\n【ASP別商品数】');
  console.table(aspCounts.rows);

  process.exit(0);
}

main();
