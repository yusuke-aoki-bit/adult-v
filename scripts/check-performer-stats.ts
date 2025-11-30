/**
 * 出演者情報統計チェックスクリプト
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== 出演者情報 統計レポート ===\n');

  // 1. 全体統計
  const total = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performer,
      (SELECT COUNT(*) FROM performers) as total_performers
  `);
  const stats = total.rows[0] as Record<string, number>;
  const totalProducts = Number(stats.total_products);
  const withPerformer = Number(stats.products_with_performer);
  const totalPerformers = Number(stats.total_performers);
  const coverageRate = ((withPerformer / totalProducts) * 100).toFixed(1);

  console.log('【全体統計】');
  console.log(`  総商品数: ${totalProducts.toLocaleString()}`);
  console.log(`  出演者情報あり: ${withPerformer.toLocaleString()} (${coverageRate}%)`);
  console.log(`  出演者情報なし: ${(totalProducts - withPerformer).toLocaleString()} (${(100 - parseFloat(coverageRate)).toFixed(1)}%)`);
  console.log(`  登録済み出演者数: ${totalPerformers.toLocaleString()}`);

  // 2. ASP別の出演者情報有無
  const aspStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT pp.product_id) as with_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);

  console.log('\n【ASP別 出演者情報カバー率】');
  for (const row of aspStats.rows) {
    const r = row as Record<string, unknown>;
    const t = Number(r.total);
    const w = Number(r.with_performer);
    const pct = t > 0 ? ((w / t) * 100).toFixed(1) : '0.0';
    const missing = t - w;
    console.log(`  ${r.asp_name}: ${w.toLocaleString()}/${t.toLocaleString()} (${pct}%) - 未整理: ${missing.toLocaleString()}件`);
  }

  // 3. 無効な女優名
  const invalidNames = await db.execute(sql`
    SELECT p.name,
      COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON pp.performer_id = p.id
    WHERE length(p.name) <= 1
       OR p.name ~ E'^[0-9]+$'
       OR p.name IN ('他', '他多数', '素人', '企画', '－', '-', '―', '…', '●', '○')
    GROUP BY p.name
    ORDER BY product_count DESC
    LIMIT 15
  `);

  console.log('\n【要整理: 無効な出演者名 TOP15】');
  for (const row of invalidNames.rows) {
    const r = row as Record<string, unknown>;
    console.log(`  "${r.name}": ${r.product_count}件の商品に紐付け`);
  }

  // 4. カンマ区切りの女優名
  const commaNames = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE name LIKE '%,%'
  `);
  const commaCount = Number((commaNames.rows[0] as Record<string, number>).cnt);
  console.log(`\n【要整理: カンマ区切り女優名】`);
  console.log(`  カンマを含む女優名: ${commaCount}件`);

  if (commaCount > 0) {
    const commaSamples = await db.execute(sql`
      SELECT name FROM performers WHERE name LIKE '%,%' LIMIT 5
    `);
    console.log('  例:');
    for (const row of commaSamples.rows) {
      console.log(`    - "${(row as Record<string, string>).name}"`);
    }
  }

  // 5. 重複候補（類似名）
  const duplicateCandidates = await db.execute(sql`
    SELECT a.name as name1, b.name as name2
    FROM performers a
    JOIN performers b ON a.id < b.id
    WHERE (
      a.name = REPLACE(b.name, ' ', '')
      OR a.name = REPLACE(b.name, '　', '')
      OR REPLACE(a.name, ' ', '') = REPLACE(b.name, '　', '')
    )
    LIMIT 10
  `);

  console.log('\n【要整理: 重複候補（スペース違い）】');
  for (const row of duplicateCandidates.rows) {
    const r = row as Record<string, string>;
    console.log(`  "${r.name1}" ↔ "${r.name2}"`);
  }

  // 6. エイリアス登録状況
  const aliasStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM performer_aliases) as total_aliases,
      (SELECT COUNT(DISTINCT performer_id) FROM performer_aliases) as performers_with_alias
  `);
  const aliasRow = aliasStats.rows[0] as Record<string, number>;
  console.log('\n【エイリアス登録状況】');
  console.log(`  登録済みエイリアス数: ${Number(aliasRow.total_aliases)}`);
  console.log(`  エイリアス持ち出演者数: ${Number(aliasRow.performers_with_alias)}`);

  console.log('\n=== レポート完了 ===');
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
