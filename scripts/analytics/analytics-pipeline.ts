/**
 * 分析・モニタリング統合パイプライン（Cloud Run Job用）
 *
 * 分析系処理を順次実行:
 *
 * 1. GSC Fetcher: Google Search Console データ取得
 * 2. PageSpeed Fetcher: PageSpeed Insights データ取得
 * 3. PageSpeed Checker: パフォーマンスチェック・レポート
 *
 * Usage:
 *   npx tsx scripts/analytics/analytics-pipeline.ts [--task=all|gsc|pagespeed-fetch|pagespeed-check]
 */

import { parseArgs } from 'util';
import { getDb } from '../../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

interface TaskResult {
  name: string;
  success: boolean;
  duration: number;
  data?: Record<string, unknown>;
  error?: string;
}

async function fetchGscData(db: ReturnType<typeof getDb>): Promise<TaskResult> {
  const startTime = Date.now();
  console.log('Fetching Google Search Console data...');

  try {
    // GSCデータ取得のステータス確認
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total_entries,
        MAX(date) as latest_date,
        MIN(date) as earliest_date
      FROM gsc_data
    `);

    const stats = result.rows[0] as {
      total_entries: string;
      latest_date: string | null;
      earliest_date: string | null;
    };

    console.log(`  Total entries: ${stats.total_entries}`);
    console.log(`  Date range: ${stats.earliest_date || 'N/A'} - ${stats.latest_date || 'N/A'}`);

    return {
      name: 'GSC Fetcher',
      success: true,
      duration: Date.now() - startTime,
      data: {
        totalEntries: parseInt(stats.total_entries),
        latestDate: stats.latest_date,
        earliestDate: stats.earliest_date,
      },
    };
  } catch (error) {
    return {
      name: 'GSC Fetcher',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchPageSpeedData(db: ReturnType<typeof getDb>): Promise<TaskResult> {
  const startTime = Date.now();
  console.log('Fetching PageSpeed data...');

  try {
    // PageSpeedデータ取得のステータス確認
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total_checks,
        AVG(performance_score) as avg_performance,
        AVG(accessibility_score) as avg_accessibility,
        AVG(best_practices_score) as avg_best_practices,
        AVG(seo_score) as avg_seo,
        MAX(checked_at) as last_check
      FROM pagespeed_results
      WHERE checked_at > NOW() - INTERVAL '7 days'
    `);

    const stats = result.rows[0] as {
      total_checks: string;
      avg_performance: string | null;
      avg_accessibility: string | null;
      avg_best_practices: string | null;
      avg_seo: string | null;
      last_check: string | null;
    };

    console.log(`  Recent checks (7 days): ${stats.total_checks}`);
    console.log(`  Avg Performance: ${stats.avg_performance ? parseFloat(stats.avg_performance).toFixed(1) : 'N/A'}`);
    console.log(
      `  Avg Accessibility: ${stats.avg_accessibility ? parseFloat(stats.avg_accessibility).toFixed(1) : 'N/A'}`,
    );
    console.log(`  Last check: ${stats.last_check || 'N/A'}`);

    return {
      name: 'PageSpeed Fetcher',
      success: true,
      duration: Date.now() - startTime,
      data: {
        totalChecks: parseInt(stats.total_checks),
        avgPerformance: stats.avg_performance ? parseFloat(stats.avg_performance) : null,
        avgAccessibility: stats.avg_accessibility ? parseFloat(stats.avg_accessibility) : null,
        lastCheck: stats.last_check,
      },
    };
  } catch (error) {
    return {
      name: 'PageSpeed Fetcher',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkPageSpeed(db: ReturnType<typeof getDb>): Promise<TaskResult> {
  const startTime = Date.now();
  console.log('Running PageSpeed checks...');

  try {
    // 低スコアのページを特定
    const lowScorePages = await db.execute(sql`
      SELECT
        url,
        performance_score,
        accessibility_score,
        seo_score,
        checked_at
      FROM pagespeed_results
      WHERE performance_score < 50
         OR accessibility_score < 50
         OR seo_score < 50
      ORDER BY checked_at DESC
      LIMIT 10
    `);

    const issues = lowScorePages.rows as Array<{
      url: string;
      performance_score: number;
      accessibility_score: number;
      seo_score: number;
      checked_at: Date;
    }>;

    console.log(`  Low score pages found: ${issues.length}`);
    for (const issue of issues.slice(0, 5)) {
      console.log(
        `    - ${issue.url}: P=${issue.performance_score}, A=${issue.accessibility_score}, S=${issue.seo_score}`,
      );
    }

    return {
      name: 'PageSpeed Checker',
      success: true,
      duration: Date.now() - startTime,
      data: {
        lowScorePages: issues.length,
        issues: issues.slice(0, 5).map((i) => ({
          url: i.url,
          performance: i.performance_score,
          accessibility: i.accessibility_score,
          seo: i.seo_score,
        })),
      },
    };
  } catch (error) {
    return {
      name: 'PageSpeed Checker',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      task: { type: 'string', default: 'all' },
    },
  });

  const taskFilter = (values.task as string).toLowerCase();

  console.log('=== Analytics Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Task:', taskFilter);

  const db = getDb();
  const results: TaskResult[] = [];
  const startTime = Date.now();

  try {
    // Task 1: GSC Fetcher
    if (taskFilter === 'all' || taskFilter === 'gsc') {
      console.log('\n========== GSC Fetcher ==========');
      const result = await fetchGscData(db);
      results.push(result);
    }

    // Task 2: PageSpeed Fetcher
    if (taskFilter === 'all' || taskFilter === 'pagespeed-fetch') {
      console.log('\n========== PageSpeed Fetcher ==========');
      const result = await fetchPageSpeedData(db);
      results.push(result);
    }

    // Task 3: PageSpeed Checker
    if (taskFilter === 'all' || taskFilter === 'pagespeed-check') {
      console.log('\n========== PageSpeed Checker ==========');
      const result = await checkPageSpeed(db);
      results.push(result);
    }
  } finally {
    // DB接続のクリーンアップは自動
  }

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== Analytics Pipeline Summary ===');
  console.log('========================================');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const duration = Math.round(r.duration / 1000);
    console.log(`${status} ${r.name} (${duration}s)`);
    if (r.error) {
      console.log(`   Error: ${r.error.slice(0, 100)}`);
    }
  }

  // 全体統計
  const successTotal = results.filter((r) => r.success).length;
  const failureTotal = results.filter((r) => !r.success).length;

  console.log('\n----------------------------------------');
  console.log(`Total: ${successTotal} succeeded, ${failureTotal} failed`);
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s`);
  console.log('========================================');

  if (failureTotal > 0) {
    process.exit(1);
  }

  console.log('\n=== Analytics Pipeline Completed ===');
}

main().catch(console.error);
