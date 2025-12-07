import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkStatus() {
  try {
    console.log('=== 女優データ状況 ===\n');

    const performers = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
    console.log('総女優数:', performers.rows[0].count);

    const withReview = await db.execute(sql`SELECT COUNT(*) as count FROM performers WHERE ai_review IS NOT NULL`);
    console.log('AIレビュー有り:', withReview.rows[0].count);

    const links = await db.execute(sql`SELECT COUNT(*) as count FROM product_performers`);
    console.log('商品-女優リンク数:', links.rows[0].count);

    // ASP別女優リンク
    console.log('\n=== ASP別女優リンク ===');
    const aspLinks = await db.execute(sql`
      SELECT ps.asp_name, COUNT(DISTINCT pp.performer_id) as performer_count, COUNT(*) as link_count
      FROM product_performers pp
      JOIN product_sources ps ON pp.product_id = ps.product_id
      GROUP BY ps.asp_name
      ORDER BY link_count DESC
    `);
    aspLinks.rows.forEach((r: any) => {
      console.log(`  ${r.asp_name}: ${r.performer_count}女優, ${r.link_count}リンク`);
    });

    // 最近の女優サンプル
    console.log('\n=== 最近登録された女優 (10件) ===');
    const samples = await db.execute(sql`
      SELECT name, name_reading,
             CASE WHEN ai_review IS NOT NULL THEN 'あり' ELSE 'なし' END as review_status
      FROM performers
      ORDER BY id DESC
      LIMIT 10
    `);
    samples.rows.forEach((r: any) => {
      console.log(`  ${r.name} (${r.name_reading || '-'}) - レビュー: ${r.review_status}`);
    });

  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

checkStatus();
