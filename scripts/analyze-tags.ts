import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * タグデータの分析
 * - 使用頻度の高いタグ
 * - 未使用タグ
 * - カテゴリ分布
 * - タグ増強の推奨事項
 */

async function analyzeTags() {
  const db = getDb();

  console.log('=== Tag Analysis ===\n');

  // 1. 総タグ数
  const totalTags = await db.execute(sql`
    SELECT COUNT(*) as count FROM tags
  `);
  console.log(`Total tags: ${totalTags.rows[0].count}\n`);

  // 2. カテゴリ別のタグ数
  console.log('=== Tags by Category ===');
  const categoryStats = await db.execute(sql`
    SELECT
      category,
      COUNT(*) as tag_count
    FROM tags
    GROUP BY category
    ORDER BY tag_count DESC
  `);
  console.table(categoryStats.rows);

  // 3. 使用頻度の高いタグ TOP 20
  console.log('\n=== Top 20 Most Used Tags ===');
  const topTags = await db.execute(sql`
    SELECT
      t.id,
      t.name,
      t.category,
      COUNT(pt.product_id) as product_count
    FROM tags t
    LEFT JOIN product_tags pt ON t.id = pt.tag_id
    GROUP BY t.id, t.name, t.category
    ORDER BY product_count DESC
    LIMIT 20
  `);
  console.table(topTags.rows);

  // 4. 未使用タグ
  console.log('\n=== Unused Tags ===');
  const unusedTags = await db.execute(sql`
    SELECT
      t.id,
      t.name,
      t.category
    FROM tags t
    LEFT JOIN product_tags pt ON t.id = pt.tag_id
    WHERE pt.tag_id IS NULL
    ORDER BY t.category, t.name
  `);
  console.log(`Unused tags count: ${unusedTags.rows.length}`);
  if (unusedTags.rows.length > 0) {
    console.table(unusedTags.rows.slice(0, 20));
    if (unusedTags.rows.length > 20) {
      console.log(`... and ${unusedTags.rows.length - 20} more\n`);
    }
  }

  // 5. 使用頻度の分布
  console.log('\n=== Tag Usage Distribution ===');
  const usageDistribution = await db.execute(sql`
    WITH tag_usage AS (
      SELECT
        t.id,
        COUNT(pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
    ),
    usage_ranges AS (
      SELECT
        CASE
          WHEN product_count = 0 THEN '0 (unused)'
          WHEN product_count BETWEEN 1 AND 10 THEN '1-10'
          WHEN product_count BETWEEN 11 AND 50 THEN '11-50'
          WHEN product_count BETWEEN 51 AND 100 THEN '51-100'
          WHEN product_count BETWEEN 101 AND 500 THEN '101-500'
          WHEN product_count BETWEEN 501 AND 1000 THEN '501-1000'
          ELSE '1000+'
        END as usage_range
      FROM tag_usage
    )
    SELECT
      usage_range,
      COUNT(*) as tag_count
    FROM usage_ranges
    GROUP BY usage_range
    ORDER BY
      CASE usage_range
        WHEN '0 (unused)' THEN 0
        WHEN '1-10' THEN 1
        WHEN '11-50' THEN 2
        WHEN '51-100' THEN 3
        WHEN '101-500' THEN 4
        WHEN '501-1000' THEN 5
        ELSE 6
      END
  `);
  console.table(usageDistribution.rows);

  // 6. ASP別のタグ付け状況
  console.log('\n=== Tag Coverage by ASP ===');
  const aspTagCoverage = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT pt.product_id) as products_with_tags,
      ROUND((100.0 * COUNT(DISTINCT pt.product_id) / NULLIF(COUNT(DISTINCT ps.product_id), 0))::numeric, 1) as coverage_pct,
      COUNT(pt.tag_id) as total_tags_assigned,
      ROUND((COUNT(pt.tag_id)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN pt.product_id IS NOT NULL THEN pt.product_id END), 0))::numeric, 1) as avg_tags_per_product
    FROM product_sources ps
    LEFT JOIN product_tags pt ON ps.product_id = pt.product_id
    GROUP BY ps.asp_name
    ORDER BY total_products DESC
  `);
  console.table(aspTagCoverage.rows);

  // 7. 推奨事項
  console.log('\n=== Recommendations ===\n');

  const unusedCount = unusedTags.rows.length;
  const totalCount = parseInt(totalTags.rows[0].count as string);

  if (unusedCount > 0) {
    console.log(`1. 未使用タグの削除を検討: ${unusedCount}件 (${Math.round(100 * unusedCount / totalCount)}%)`);
  }

  const lowUsageTags = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM (
      SELECT t.id, COUNT(pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
      HAVING COUNT(pt.product_id) BETWEEN 1 AND 10
    ) as low_usage
  `);
  const lowUsageCount = parseInt(lowUsageTags.rows[0].count as string);
  if (lowUsageCount > 0) {
    console.log(`2. 低使用頻度タグ(1-10件): ${lowUsageCount}件 - 統合または削除を検討`);
  }

  const avgCoverage = aspTagCoverage.rows.reduce((sum, row: any) => sum + parseFloat(row.coverage_pct || 0), 0) / aspTagCoverage.rows.length;
  console.log(`3. タグ付けカバレッジ平均: ${avgCoverage.toFixed(1)}% - タグの自動付与機能の実装を推奨`);

  console.log(`4. カテゴリの追加を検討: ジャンル、シリーズ、スタジオ、年代など`);
  console.log(`5. 人気タグに基づいた関連タグの自動提案機能の実装を推奨`);

  // 8. タイトルからのキーワード抽出サンプル
  console.log('\n=== Sample Title Keywords (for auto-tagging) ===');
  const sampleTitles = await db.execute(sql`
    SELECT title
    FROM products
    WHERE title IS NOT NULL AND title != ''
    ORDER BY RANDOM()
    LIMIT 10
  `);

  const commonKeywords = new Map<string, number>();
  const keywords = ['素人', '美少女', '痴漢', '中出し', '巨乳', 'OL', '人妻', '若妻',
                   'ナンパ', 'コスプレ', '3P', '4P', 'アナル', 'SM', 'フェラ',
                   '潮吹き', 'ギャル', 'ロリ', '熟女', '女子校生', '制服'];

  for (const row of sampleTitles.rows as any[]) {
    const title = row.title || '';
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        commonKeywords.set(keyword, (commonKeywords.get(keyword) || 0) + 1);
      }
    }
  }

  console.log('\nCommon keywords found in sample titles:');
  const sortedKeywords = Array.from(commonKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [keyword, count] of sortedKeywords) {
    console.log(`  ${keyword}: ${count} occurrences`);
  }

  process.exit(0);
}

analyzeTags().catch(console.error);
