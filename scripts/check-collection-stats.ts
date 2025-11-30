import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // プロバイダー別の商品数
  const providerCounts = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('=== プロバイダー別商品数 ===');
  providerCounts.rows.forEach((r: any) => console.log(`${r.asp_name}: ${r.count}`));

  // 総商品数
  const totalProducts = await db.execute(sql`SELECT COUNT(*) as total FROM products`);
  console.log('\n=== 総商品数 ===');
  console.log((totalProducts.rows[0] as any).total);

  // 女優数
  const totalPerformers = await db.execute(sql`SELECT COUNT(*) as total FROM performers`);
  console.log('\n=== 女優数 ===');
  console.log((totalPerformers.rows[0] as any).total);

  // タグ数
  const totalTags = await db.execute(sql`SELECT COUNT(*) as total FROM tags`);
  console.log('\n=== タグ数 ===');
  console.log((totalTags.rows[0] as any).total);

  // 最新の商品リリース日時（プロバイダー別）
  const latestRelease = await db.execute(sql`
    SELECT ps.asp_name, MAX(p.release_date) as latest_release
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    GROUP BY ps.asp_name
    ORDER BY latest_release DESC
  `);
  console.log('\n=== 最新リリース日（プロバイダー別） ===');
  latestRelease.rows.forEach((r: any) => console.log(`${r.asp_name}: ${r.latest_release}`));

  // 月別収集数（productsのcreated_atを使用）
  const monthlyCounts = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', p.created_at) as month,
      ps.asp_name,
      COUNT(*) as count
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE p.created_at > NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', p.created_at), ps.asp_name
    ORDER BY month DESC, count DESC
  `);
  console.log('\n=== 過去6ヶ月の月別収集数 ===');
  monthlyCounts.rows.forEach((r: any) => {
    const month = new Date(r.month).toISOString().slice(0, 7);
    console.log(`${month} | ${r.asp_name}: ${r.count}`);
  });

  // 日別収集数（過去14日）
  const dailyCounts = await db.execute(sql`
    SELECT DATE(p.created_at) as date, ps.asp_name, COUNT(*) as count
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE p.created_at > NOW() - INTERVAL '14 days'
    GROUP BY DATE(p.created_at), ps.asp_name
    ORDER BY date DESC, count DESC
  `);
  console.log('\n=== 過去14日の日別収集数 ===');
  dailyCounts.rows.forEach((r: any) => console.log(`${r.date} | ${r.asp_name}: ${r.count}`));

  // 生データの収集状況
  const rawDataCounts = await db.execute(sql`
    SELECT 'raw_html_data' as table_name, COUNT(*) as count FROM raw_html_data
    UNION ALL
    SELECT 'raw_csv_data', COUNT(*) FROM raw_csv_data
    UNION ALL
    SELECT 'duga_raw_responses', COUNT(*) FROM duga_raw_responses
    UNION ALL
    SELECT 'sokmil_raw_responses', COUNT(*) FROM sokmil_raw_responses
  `);
  console.log('\n=== 生データテーブル件数 ===');
  rawDataCounts.rows.forEach((r: any) => console.log(`${r.table_name}: ${r.count}`));

  // 各サイトの推定総数との比較（収集率の参考）
  console.log('\n=== 収集率の参考（推定） ===');
  const estimates: Record<string, number> = {
    'DUGA': 500000,      // DUGA: 推定50万作品以上
    'DTI': 50000,        // DTI系（カリビアンコム等）: 推定5万作品程度
    'b10f': 30000,       // B10F: 推定3万作品程度
    'MGS': 100000,       // MGS: 推定10万作品以上
    'Japanska': 40000,   // Japanska: 推定4万作品程度
    'FC2': 1000000,      // FC2: 推定100万作品以上
    'ソクミル': 200000,   // ソクミル: 推定20万作品以上
  };

  providerCounts.rows.forEach((r: any) => {
    const estimate = estimates[r.asp_name];
    if (estimate) {
      const rate = ((parseInt(r.count) / estimate) * 100).toFixed(2);
      console.log(`${r.asp_name}: ${r.count} / ${estimate.toLocaleString()} (約${rate}%)`);
    }
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
