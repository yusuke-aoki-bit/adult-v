import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS商品 カテゴリ/タイプ別統計 ===\n');

  // 1. product_type別統計
  console.log('📊 product_type別:');
  const mgsStats = await db.execute(sql`
    SELECT
      ps.product_type,
      COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    GROUP BY ps.product_type
    ORDER BY count DESC
  `);

  for (const r of mgsStats.rows) {
    console.log(`  ${r.product_type || '(null)'}: ${r.count}`);
  }

  // 2. raw_html_dataのMGSデータでURLパターン別統計
  console.log('\n📊 raw_html_data URL分析:');

  const urlPatterns = await db.execute(sql`
    SELECT
      CASE
        WHEN url LIKE '%type=haishin%' THEN '動画配信(haishin)'
        WHEN url LIKE '%/ppv/dvd/%' THEN 'DVD'
        WHEN url LIKE '%/superch/%' THEN 'S1ch'
        WHEN url LIKE '%/docch/%' THEN 'DOCch'
        WHEN url LIKE '%/prestigebb/%' THEN 'プレステージBB'
        WHEN url LIKE '%/kanbich/%' THEN 'かんぱにBB'
        WHEN url LIKE '%/sodch/%' THEN 'SODch'
        WHEN url LIKE '%/hmpbb/%' THEN 'HMPch'
        WHEN url LIKE '%/hotbb/%' THEN 'HOTch'
        WHEN url LIKE '%/nextbb/%' THEN 'NEXTch'
        WHEN url LIKE '%/product_detail/%' THEN '商品詳細'
        ELSE 'その他'
      END as category,
      COUNT(*) as count
    FROM raw_html_data
    WHERE source = 'MGS'
    GROUP BY
      CASE
        WHEN url LIKE '%type=haishin%' THEN '動画配信(haishin)'
        WHEN url LIKE '%/ppv/dvd/%' THEN 'DVD'
        WHEN url LIKE '%/superch/%' THEN 'S1ch'
        WHEN url LIKE '%/docch/%' THEN 'DOCch'
        WHEN url LIKE '%/prestigebb/%' THEN 'プレステージBB'
        WHEN url LIKE '%/kanbich/%' THEN 'かんぱにBB'
        WHEN url LIKE '%/sodch/%' THEN 'SODch'
        WHEN url LIKE '%/hmpbb/%' THEN 'HMPch'
        WHEN url LIKE '%/hotbb/%' THEN 'HOTch'
        WHEN url LIKE '%/nextbb/%' THEN 'NEXTch'
        WHEN url LIKE '%/product_detail/%' THEN '商品詳細'
        ELSE 'その他'
      END
    ORDER BY count DESC
  `);

  for (const r of urlPatterns.rows) {
    console.log(`  ${r.category}: ${r.count}`);
  }

  // 3. MGS商品のoriginal_product_id パターン分析
  console.log('\n📊 MGS original_product_id プレフィックス分析:');

  const idPatterns = await db.execute(sql`
    SELECT
      SUBSTRING(ps.original_product_id, 1, 3) as prefix,
      COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    GROUP BY SUBSTRING(ps.original_product_id, 1, 3)
    ORDER BY count DESC
    LIMIT 20
  `);

  for (const r of idPatterns.rows) {
    console.log(`  ${r.prefix}: ${r.count}`);
  }

  // 4. サンプルURL確認
  console.log('\n📊 サンプルURL確認:');

  const sampleUrls = await db.execute(sql`
    SELECT url, product_id
    FROM raw_html_data
    WHERE source = 'MGS'
    LIMIT 5
  `);

  for (const r of sampleUrls.rows) {
    console.log(`  ${r.product_id}: ${r.url}`);
  }

  // 5. DVDと月額チャンネルの取得状況
  console.log('\n📊 DVD/月額チャンネルの商品数:');

  // DVDタイプ
  const dvdCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS' AND product_type = 'dvd'
  `);
  console.log(`  DVD: ${dvdCount.rows[0].count}`);

  // 月額チャンネル
  const channelCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS' AND product_type = 'monthly'
  `);
  console.log(`  月額チャンネル: ${channelCount.rows[0].count}`)

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
