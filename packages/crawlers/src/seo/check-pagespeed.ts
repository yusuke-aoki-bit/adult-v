/**
 * PageSpeed Insights API を使用してサイトのパフォーマンスを定期チェック
 * 結果をログに出力し、スコアが閾値以下の場合は警告
 */

interface PageSpeedResult {
  lighthouseResult: {
    categories: {
      performance?: { score: number };
      accessibility?: { score: number };
      'best-practices'?: { score: number };
      seo?: { score: number };
    };
    audits: {
      'first-contentful-paint'?: { numericValue: number };
      'largest-contentful-paint'?: { numericValue: number };
      'total-blocking-time'?: { numericValue: number };
      'cumulative-layout-shift'?: { numericValue: number };
      'speed-index'?: { numericValue: number };
    };
  };
  loadingExperience?: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      FIRST_INPUT_DELAY_MS?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
    };
  };
}

interface CheckResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  timestamp: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    fcp: number;
    lcp: number;
    tbt: number;
    cls: number;
    si: number;
  };
  passed: boolean;
}

// 閾値設定
const THRESHOLDS = {
  performance: 0.7, // 70点以上
  accessibility: 0.9, // 90点以上
  seo: 0.9, // 90点以上
  lcp: 4000, // 4秒以下
};

// チェック対象URL
const URLS_TO_CHECK = [
  'https://www.adult-v.com/ja',
  'https://www.adult-v.com/ja/products',
];

async function runPageSpeedCheck(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<CheckResult> {
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('strategy', strategy);
  // Use append for multiple category parameters
  apiUrl.searchParams.append('category', 'performance');
  apiUrl.searchParams.append('category', 'accessibility');
  apiUrl.searchParams.append('category', 'best-practices');
  apiUrl.searchParams.append('category', 'seo');

  // APIキーがあれば使用（レート制限緩和）
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) {
    apiUrl.searchParams.set('key', apiKey);
  }

  console.log(`[PageSpeed] Checking ${url} (${strategy})...`);

  const response = await fetch(apiUrl.toString());
  if (!response.ok) {
    throw new Error(`PageSpeed API error: ${response.status} ${response.statusText}`);
  }

  const data: PageSpeedResult = await response.json();

  // Debug: check if data exists
  if (!data.lighthouseResult) {
    console.error('[DEBUG] No lighthouseResult in response');
    console.error('[DEBUG] Response keys:', Object.keys(data));
    throw new Error('Invalid API response: missing lighthouseResult');
  }

  const categories = data.lighthouseResult.categories;
  const audits = data.lighthouseResult.audits;

  // Debug: log raw scores
  console.log(`[DEBUG] Raw scores: perf=${categories.performance?.score}, a11y=${categories.accessibility?.score}`);

  const scores = {
    performance: (categories.performance?.score ?? 0) * 100,
    accessibility: (categories.accessibility?.score ?? 0) * 100,
    bestPractices: (categories['best-practices']?.score ?? 0) * 100,
    seo: (categories.seo?.score ?? 0) * 100,
  };

  const metrics = {
    fcp: audits['first-contentful-paint']?.numericValue ?? 0,
    lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
    tbt: audits['total-blocking-time']?.numericValue ?? 0,
    cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
    si: audits['speed-index']?.numericValue ?? 0,
  };

  // 閾値チェック
  const passed =
    scores.performance >= THRESHOLDS.performance * 100 &&
    scores.accessibility >= THRESHOLDS.accessibility * 100 &&
    scores.seo >= THRESHOLDS.seo * 100 &&
    metrics.lcp <= THRESHOLDS.lcp;

  return {
    url,
    strategy,
    timestamp: new Date().toISOString(),
    scores,
    metrics,
    passed,
  };
}

function formatResult(result: CheckResult): string {
  const statusEmoji = result.passed ? '✅' : '⚠️';

  return `
${statusEmoji} PageSpeed Check: ${result.url} (${result.strategy})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Scores:
   Performance:    ${result.scores.performance.toFixed(0)}  ${result.scores.performance >= THRESHOLDS.performance * 100 ? '✓' : '✗'}
   Accessibility:  ${result.scores.accessibility.toFixed(0)}  ${result.scores.accessibility >= THRESHOLDS.accessibility * 100 ? '✓' : '✗'}
   Best Practices: ${result.scores.bestPractices.toFixed(0)}
   SEO:            ${result.scores.seo.toFixed(0)}  ${result.scores.seo >= THRESHOLDS.seo * 100 ? '✓' : '✗'}

⏱️ Core Web Vitals:
   FCP: ${(result.metrics.fcp / 1000).toFixed(2)}s
   LCP: ${(result.metrics.lcp / 1000).toFixed(2)}s  ${result.metrics.lcp <= THRESHOLDS.lcp ? '✓' : '✗'}
   TBT: ${result.metrics.tbt.toFixed(0)}ms
   CLS: ${result.metrics.cls.toFixed(3)}
   SI:  ${(result.metrics.si / 1000).toFixed(2)}s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

async function main() {
  console.log('=== PageSpeed Insights Check ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const results: CheckResult[] = [];
  let hasFailures = false;

  for (const url of URLS_TO_CHECK) {
    try {
      // モバイルチェック
      const mobileResult = await runPageSpeedCheck(url, 'mobile');
      results.push(mobileResult);
      console.log(formatResult(mobileResult));

      if (!mobileResult.passed) {
        hasFailures = true;
      }

      // APIレート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));

      // デスクトップチェック
      const desktopResult = await runPageSpeedCheck(url, 'desktop');
      results.push(desktopResult);
      console.log(formatResult(desktopResult));

      if (!desktopResult.passed) {
        hasFailures = true;
      }

      // 次のURLまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[ERROR] Failed to check ${url}:`, error);
      hasFailures = true;
    }
  }

  // サマリー
  console.log('\n=== Summary ===');
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);

  if (hasFailures) {
    console.log('\n⚠️ Some checks did not meet thresholds. Review the results above.');
  } else {
    console.log('\n✅ All checks passed!');
  }

  // JSON出力（ログ解析用）
  console.log('\n--- JSON Results ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
