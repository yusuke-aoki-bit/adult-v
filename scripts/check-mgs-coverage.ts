import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS商品 充足率分析 ===\n');

  // 1. 全体の商品数
  const totalCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'MGS'
  `);
  const total = Number(totalCount.rows[0].count);
  console.log('📊 MGS総商品数:', total);

  // 2. product_type別
  console.log('\n📊 カテゴリ別商品数:');
  const byType = await db.execute(sql`
    SELECT product_type, COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS'
    GROUP BY product_type
    ORDER BY count DESC
  `);
  for (const r of byType.rows) {
    console.log(`  ${r.product_type || '(null)'}: ${r.count}`);
  }

  // 3. 動画データの充足率
  console.log('\n📊 動画データ充足率:');
  const withVideo = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_videos pv ON ps.product_id = pv.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  const videoCount = Number(withVideo.rows[0].count);
  console.log(`  動画あり商品: ${videoCount} / ${total} (${(videoCount / total * 100).toFixed(1)}%)`);

  // 4. 画像データの充足率
  console.log('\n📊 画像データ充足率:');
  const withImage = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_images pi ON ps.product_id = pi.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  const imageCount = Number(withImage.rows[0].count);
  console.log(`  画像あり商品: ${imageCount} / ${total} (${(imageCount / total * 100).toFixed(1)}%)`);

  // サムネイル
  const withThumbnail = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_images pi ON ps.product_id = pi.product_id
    WHERE ps.asp_name = 'MGS' AND pi.image_type = 'thumbnail'
  `);
  const thumbCount = Number(withThumbnail.rows[0].count);
  console.log(`  サムネイルあり: ${thumbCount} / ${total} (${(thumbCount / total * 100).toFixed(1)}%)`);

  // サンプル画像
  const withSample = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_images pi ON ps.product_id = pi.product_id
    WHERE ps.asp_name = 'MGS' AND pi.image_type = 'sample'
  `);
  const sampleCount = Number(withSample.rows[0].count);
  console.log(`  サンプル画像あり: ${sampleCount} / ${total} (${(sampleCount / total * 100).toFixed(1)}%)`);

  // 5. 演者データの充足率
  console.log('\n📊 演者データ充足率:');
  const withPerformer = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  const performerCount = Number(withPerformer.rows[0].count);
  console.log(`  演者あり商品: ${performerCount} / ${total} (${(performerCount / total * 100).toFixed(1)}%)`);

  // 6. タグデータの充足率
  console.log('\n📊 タグデータ充足率:');
  const withTag = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as count
    FROM product_sources ps
    JOIN product_tags pt ON ps.product_id = pt.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  const tagCount = Number(withTag.rows[0].count);
  console.log(`  タグあり商品: ${tagCount} / ${total} (${(tagCount / total * 100).toFixed(1)}%)`);

  // 7. 価格データの充足率
  console.log('\n📊 価格データ充足率:');
  const withPrice = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS' AND price IS NOT NULL
  `);
  const priceCount = Number(withPrice.rows[0].count);
  console.log(`  価格あり商品: ${priceCount} / ${total} (${(priceCount / total * 100).toFixed(1)}%)`);

  // 8. サイト上の推定総商品数との比較
  console.log('\n📊 サイト推定値との比較:');
  const haishinCount = byType.rows.find(r => r.product_type === 'haishin');
  const dvdCount = byType.rows.find(r => r.product_type === 'dvd');
  const monthlyCount = byType.rows.find(r => r.product_type === 'monthly');

  console.log('  動画配信 (haishin):');
  console.log(`    サイト検索結果: 約10,000件（84ページ×120件、ループあり）`);
  console.log(`    DB上: ${haishinCount?.count || 0}件`);
  console.log(`    充足率: ${((Number(haishinCount?.count || 0) / 10000) * 100).toFixed(1)}%+`);

  console.log('  DVD:');
  console.log(`    DB上: ${dvdCount?.count || 0}件 (クロール中)`);

  console.log('  月額チャンネル:');
  console.log(`    DB上: ${monthlyCount?.count || 0}件 (クロール中)`);

  // 9. 欠落データの詳細
  console.log('\n📊 欠落データ詳細:');

  // 動画なし商品のサンプル
  const noVideo = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    LEFT JOIN product_videos pv ON ps.product_id = pv.product_id
    WHERE ps.asp_name = 'MGS' AND pv.id IS NULL
    LIMIT 5
  `);
  console.log(`  動画なし商品サンプル: ${noVideo.rows.map(r => r.original_product_id).join(', ')}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
