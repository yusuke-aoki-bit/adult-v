/**
 * FANZAデータの収集状況を確認するスクリプト
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../lib/db';

async function main() {
  console.log('📊 FANZAデータ収集状況チェック');

  const db = getDb();

  try {
    // 全体統計
    const totalStats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(duration) as with_duration,
        COUNT(NULLIF(duration, 0)) as nonzero_duration,
        AVG(duration) FILTER (WHERE duration > 0) as avg_duration,
        MIN(duration) FILTER (WHERE duration > 0) as min_duration,
        MAX(duration) FILTER (WHERE duration > 0) as max_duration
      FROM products
      WHERE normalized_product_id LIKE 'FANZA-%'
    `);
    console.log('\n📦 商品統計:');
    console.table(totalStats.rows);

    // 価格統計
    const priceStats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(ps.price) as with_price,
        COUNT(NULLIF(ps.price, 0)) as nonzero_price,
        AVG(ps.price) FILTER (WHERE ps.price > 0) as avg_price,
        MIN(ps.price) FILTER (WHERE ps.price > 0) as min_price,
        MAX(ps.price) FILTER (WHERE ps.price > 0) as max_price
      FROM products p
      LEFT JOIN product_sources ps ON p.id = ps.product_id AND ps.asp_name = 'FANZA'
      WHERE p.normalized_product_id LIKE 'FANZA-%'
    `);
    console.log('\n💰 価格統計 (product_sources):');
    console.table(priceStats.rows);

    // 最近の商品サンプル（duration/priceあり）
    const recentWithData = await db.execute(sql`
      SELECT
        p.normalized_product_id,
        p.title,
        p.duration,
        ps.price,
        p.created_at
      FROM products p
      LEFT JOIN product_sources ps ON p.id = ps.product_id AND ps.asp_name = 'FANZA'
      WHERE p.normalized_product_id LIKE 'FANZA-%'
        AND (p.duration IS NOT NULL OR ps.price IS NOT NULL)
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    console.log('\n📝 最近の商品（データあり）:');
    console.table(recentWithData.rows);

    // 最近の商品サンプル（duration/priceなし）
    const recentWithoutData = await db.execute(sql`
      SELECT
        p.normalized_product_id,
        p.title,
        p.duration,
        ps.price,
        p.created_at
      FROM products p
      LEFT JOIN product_sources ps ON p.id = ps.product_id AND ps.asp_name = 'FANZA'
      WHERE p.normalized_product_id LIKE 'FANZA-%'
        AND p.duration IS NULL
        AND (ps.price IS NULL OR ps.price = 0)
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    console.log('\n⚠️ 最近の商品（データなし）:');
    console.table(recentWithoutData.rows);

    // レビュー統計
    const reviewStats = await db.execute(sql`
      SELECT
        COUNT(*) as review_count,
        COUNT(DISTINCT product_id) as products_with_reviews
      FROM product_reviews
      WHERE asp_name = 'FANZA'
    `);
    console.log('\n📝 レビュー統計:');
    console.table(reviewStats.rows);

    // 評価サマリー統計
    const ratingStats = await db.execute(sql`
      SELECT
        COUNT(*) as rating_count,
        AVG(CAST(average_rating AS NUMERIC)) as avg_rating
      FROM product_rating_summary
      WHERE asp_name = 'FANZA'
    `);
    console.log('\n⭐ 評価サマリー統計:');
    console.table(ratingStats.rows);
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
