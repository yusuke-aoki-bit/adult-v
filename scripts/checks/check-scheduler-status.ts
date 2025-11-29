import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== Cloud Scheduler 状況確認 ===\n');

  // 1. ASP別商品数
  console.log('【1】ASP別商品数:');
  const aspStats = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(aspStats.rows);

  // 2. クロール状況（raw_html_dataから）
  console.log('\n【2】クロール状況 (raw_html_data):');
  const recentCrawls = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as total,
      COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed,
      MAX(crawled_at) as last_crawl
    FROM raw_html_data
    GROUP BY source
    ORDER BY last_crawl DESC
  `);
  console.table(recentCrawls.rows);

  // 3. 直近24時間の新規商品
  console.log('\n【3】直近24時間の新規商品:');
  const recentProducts = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY ps.asp_name
    ORDER BY count DESC
  `);
  if (recentProducts.rows.length === 0) {
    console.log('直近24時間の新規商品はありません');
  } else {
    console.table(recentProducts.rows);
  }

  // 4. DTIサイト別内訳
  console.log('\n【4】DTIサイト別内訳:');
  const dtiSites = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE '一本道-%' THEN '一本道'
        WHEN p.normalized_product_id LIKE 'カリビアンコム-%' THEN 'カリビアンコム'
        WHEN p.normalized_product_id LIKE 'カリビアンコムプレミアム-%' THEN 'カリビアンコムプレミアム'
        WHEN p.normalized_product_id LIKE 'HEYZO-%' THEN 'HEYZO'
        ELSE 'その他'
      END as site,
      COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY 1
    ORDER BY count DESC
  `);
  console.table(dtiSites.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
