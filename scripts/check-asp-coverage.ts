/**
 * ASP別商品充足度チェック
 * DBの商品数と各サイトの推定総商品数を比較
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

// 各サイトの推定総商品数（API/公式発表/調査に基づく）
// 2024/12/07更新: fetch-asp-totals.ts で取得した実際の数値
const ESTIMATED_CATALOG_SIZES: Record<string, { total: number; source: string }> = {
  'b10f': { total: 22134, source: 'b10f CSV行数 (2024/12)' },
  'MGS': { total: 40080, source: 'MGSページネーション (334p x 120件)' },
  'DUGA': { total: 185909, source: 'DUGA API (2024/12)' },
  'SOKMIL': { total: 150000, source: 'ソクミル公式' },
  'HEYZO': { total: 3774, source: 'heyzo.com最大ID (2024/12)' },
  'カリビアンコムプレミアム': { total: 6000, source: 'caribpr推定' },
  'Japanska': { total: 35648, source: 'japanska最大ID (2024/12)' },
  'FC2': { total: 500000, source: 'FC2（非常に多い）' },
};

async function checkCoverage() {
  const db = getDb();

  console.log('=== ASP別 商品充足度チェック ===\n');

  // DBの商品数を取得
  const stats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*)::int as db_count,
      COUNT(DISTINCT product_id)::int as unique_products,
      MAX(last_updated) as last_update
    FROM product_sources
    GROUP BY asp_name
    ORDER BY db_count DESC
  `);

  console.log('| ASP | DB商品数 | 推定総数 | 充足率 | 最終更新 |');
  console.log('|-----|----------|----------|--------|----------|');

  for (const row of stats.rows) {
    const r = row as {
      asp_name: string;
      db_count: number;
      unique_products: number;
      last_update: string;
    };

    const estimated = ESTIMATED_CATALOG_SIZES[r.asp_name];
    const coverage = estimated
      ? ((r.db_count / estimated.total) * 100).toFixed(1) + '%'
      : '不明';
    const estimatedStr = estimated ? estimated.total.toLocaleString() : '?';
    const lastUpdate = r.last_update
      ? new Date(r.last_update).toLocaleDateString('ja-JP')
      : '-';

    console.log(
      `| ${r.asp_name.padEnd(20)} | ${String(r.db_count).padStart(8)} | ${estimatedStr.padStart(8)} | ${coverage.padStart(6)} | ${lastUpdate} |`
    );
  }

  // 未クロールのASPをチェック
  console.log('\n=== 未クロールまたは商品0件のASP ===');
  const missingAsps = Object.keys(ESTIMATED_CATALOG_SIZES).filter(
    asp => !stats.rows.find((r: any) => r.asp_name === asp)
  );

  if (missingAsps.length > 0) {
    for (const asp of missingAsps) {
      const info = ESTIMATED_CATALOG_SIZES[asp];
      console.log(`❌ ${asp}: 0件 (推定${info.total.toLocaleString()}件)`);
    }
  } else {
    console.log('✅ 全ASPにデータあり');
  }

  // 出演者数も確認
  const performerStats = await db.execute(sql`
    SELECT COUNT(*)::int as total_performers
    FROM performers
  `);
  console.log(`\n出演者総数: ${(performerStats.rows[0] as any).total_performers}人`);

  // 商品-出演者紐付け率
  const linkStats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT p.id)::int as total_products,
      COUNT(DISTINCT pp.product_id)::int as linked_products
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
  `);
  const ls = linkStats.rows[0] as { total_products: number; linked_products: number };
  const linkRate = ((ls.linked_products / ls.total_products) * 100).toFixed(1);
  console.log(
    `商品-出演者紐付け: ${ls.linked_products.toLocaleString()}/${ls.total_products.toLocaleString()} (${linkRate}%)`
  );

  process.exit(0);
}

checkCoverage().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
