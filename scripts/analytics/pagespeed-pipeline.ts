/**
 * PageSpeed統合パイプライン
 *
 * PageSpeed Insightsのデータ取得とチェックを統合:
 * 1. Fetcher: 主要ページのPageSpeedデータを取得
 * 2. Checker: 取得したデータを分析・レポート
 *
 * Usage:
 *   npx tsx scripts/analytics/pagespeed-pipeline.ts [--task=all|fetch|check]
 */

import { parseArgs } from 'util';
import { getDb } from '../../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY;

interface PageSpeedResult {
  url: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number; // First Contentful Paint (ms)
  lcp: number; // Largest Contentful Paint (ms)
  cls: number; // Cumulative Layout Shift
}

const PAGES_TO_CHECK = ['/', '/products', '/actresses', '/categories'];

async function fetchPageSpeedData(url: string): Promise<PageSpeedResult | null> {
  if (!PAGESPEED_API_KEY) {
    console.log('  PAGESPEED_API_KEY not configured');
    return null;
  }

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${PAGESPEED_API_KEY}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const lighthouse = data.lighthouseResult;

    return {
      url,
      performance: Math.round((lighthouse.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lighthouse.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lighthouse.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lighthouse.categories.seo?.score || 0) * 100),
      fcp: lighthouse.audits['first-contentful-paint']?.numericValue || 0,
      lcp: lighthouse.audits['largest-contentful-paint']?.numericValue || 0,
      cls: lighthouse.audits['cumulative-layout-shift']?.numericValue || 0,
    };
  } catch (error) {
    console.error(`  Error fetching ${url}:`, error);
    return null;
  }
}

async function runFetchTask(db: ReturnType<typeof getDb>, baseUrl: string): Promise<number> {
  console.log('Running PageSpeed Fetch task...');
  let successCount = 0;

  for (const path of PAGES_TO_CHECK) {
    const fullUrl = `${baseUrl}${path}`;
    console.log(`  Fetching: ${fullUrl}`);

    const result = await fetchPageSpeedData(fullUrl);
    if (result) {
      await db.execute(sql`
        INSERT INTO pagespeed_results (
          url, performance_score, accessibility_score,
          best_practices_score, seo_score,
          fcp_ms, lcp_ms, cls, checked_at
        ) VALUES (
          ${result.url}, ${result.performance}, ${result.accessibility},
          ${result.bestPractices}, ${result.seo},
          ${result.fcp}, ${result.lcp}, ${result.cls}, NOW()
        )
        ON CONFLICT (url) DO UPDATE SET
          performance_score = EXCLUDED.performance_score,
          accessibility_score = EXCLUDED.accessibility_score,
          best_practices_score = EXCLUDED.best_practices_score,
          seo_score = EXCLUDED.seo_score,
          fcp_ms = EXCLUDED.fcp_ms,
          lcp_ms = EXCLUDED.lcp_ms,
          cls = EXCLUDED.cls,
          checked_at = NOW()
      `);

      console.log(`    P=${result.performance} A=${result.accessibility} BP=${result.bestPractices} SEO=${result.seo}`);
      successCount++;
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  return successCount;
}

async function runCheckTask(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Running PageSpeed Check task...');

  // 直近のスコアを取得
  const recentResults = await db.execute(sql`
    SELECT url, performance_score, accessibility_score, seo_score, checked_at
    FROM pagespeed_results
    WHERE checked_at > NOW() - INTERVAL '7 days'
    ORDER BY checked_at DESC
  `);

  console.log(`\n  Recent results (${recentResults.rows.length} pages):`);

  let lowScoreCount = 0;
  for (const row of recentResults.rows as Array<{
    url: string;
    performance_score: number;
    accessibility_score: number;
    seo_score: number;
    checked_at: Date;
  }>) {
    const isLow = row.performance_score < 50 || row.accessibility_score < 50 || row.seo_score < 50;
    const status = isLow ? '⚠️' : '✅';
    console.log(
      `    ${status} ${row.url}: P=${row.performance_score} A=${row.accessibility_score} SEO=${row.seo_score}`,
    );
    if (isLow) lowScoreCount++;
  }

  // 平均スコア
  const avgResult = await db.execute(sql`
    SELECT
      AVG(performance_score) as avg_perf,
      AVG(accessibility_score) as avg_a11y,
      AVG(seo_score) as avg_seo
    FROM pagespeed_results
    WHERE checked_at > NOW() - INTERVAL '7 days'
  `);

  const avg = avgResult.rows[0] as {
    avg_perf: string;
    avg_a11y: string;
    avg_seo: string;
  };

  console.log('\n  Average scores (7 days):');
  console.log(`    Performance: ${parseFloat(avg.avg_perf || '0').toFixed(1)}`);
  console.log(`    Accessibility: ${parseFloat(avg.avg_a11y || '0').toFixed(1)}`);
  console.log(`    SEO: ${parseFloat(avg.avg_seo || '0').toFixed(1)}`);

  if (lowScoreCount > 0) {
    console.log(`\n  ⚠️ ${lowScoreCount} pages have low scores (< 50)`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      task: { type: 'string', default: 'all' },
    },
  });

  const taskFilter = (values.task as string).toLowerCase();
  const baseUrl = process.env.SITE_URL || 'https://adult-v.com';

  console.log('=== PageSpeed Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Task:', taskFilter);
  console.log('Base URL:', baseUrl);

  const db = getDb();
  const startTime = Date.now();

  try {
    if (taskFilter === 'all' || taskFilter === 'fetch') {
      const fetched = await runFetchTask(db, baseUrl);
      console.log(`\nFetch completed: ${fetched}/${PAGES_TO_CHECK.length} pages`);
    }

    if (taskFilter === 'all' || taskFilter === 'check') {
      await runCheckTask(db);
    }
  } catch (error) {
    console.error('Pipeline error:', error);
    process.exit(1);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=== PageSpeed Pipeline Completed (${duration}s) ===`);
}

main().catch(console.error);
