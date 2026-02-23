import { test, expect, type Page } from '@playwright/test';

test.setTimeout(120000);

// Target URL: use env var or fallback to production
const BASE = process.env['E2E_BASE_URL'] || 'https://www.adult-v.com';
const SKIP_IN_CI = !!process.env['CI'] && !process.env['E2E_BASE_URL'];
const BASE_HOST = new URL(BASE).hostname;

test.beforeEach(async ({}, testInfo) => {
  if (SKIP_IN_CI) testInfo.skip(true, 'Skipped in CI without E2E_BASE_URL');
});

function url(path: string): string {
  return `${BASE}${path}`;
}

// ──────────────────────────────────────────
// 無視するパターン定義
// ──────────────────────────────────────────

/** JS例外で無視するメッセージ */
const BENIGN_PAGEERROR_PATTERNS = [
  'ResizeObserver',
  'Loading chunk',
  'ChunkLoadError',
  'gtag',
  // Hydration mismatch (non-critical in production)
  'Minified React error',
  'Hydration',
  'hydrat',
  // Browser extensions
  'Extension context',
];

/** console.error/warn で無視するメッセージ */
const BENIGN_CONSOLE_PATTERNS = [
  // Firebase App Check (reCAPTCHAキー未設定)
  'reCAPTCHA',
  'App Check',
  'appCheck',
  // Sentry
  'Sentry',
  'sentry',
  // Next.js dev warnings
  'Fast Refresh',
  'next-dev.js',
  // React strict mode
  'findDOMNode is deprecated',
  // Performance API
  'Performance',
  'Tries left',
  // Cookie consent / third-party
  'cookie',
  'consent',
  // Browser extension noise
  'Extension',
  'chrome-extension',
  // Google services
  'gtag',
  'google',
  'recaptcha',
  // Known deprecation warnings
  'deprecated',
  'Deprecation',
];

/** 404レスポンスで無視するURLパターン */
const BENIGN_404_PATTERNS = [
  '/monitoring', // Sentry tunnel (may not be deployed yet)
  '/favicon.ico', // Optional favicon
  '/manifest.json', // PWA manifest (optional)
  '/sw.js', // Service worker (optional)
  'google-analytics',
  'googletagmanager',
  'firebaseinstallations',
  'firebaselogging',
  'sentry.io',
  'region1.google-analytics',
  // External image sources that may 404
  '.dmm.co.jp',
  '.dmm.com',
  '.duga.jp',
  '.mgstage.com',
  '.sokmil.com',
  '.minnano-av.com',
];

/** URLがサイト内のAPIリクエストかどうか */
function isSameOriginApi(reqUrl: string): boolean {
  try {
    const u = new URL(reqUrl);
    return u.hostname === BASE_HOST && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** URLが無視対象の404か */
function isBenign404(reqUrl: string): boolean {
  return BENIGN_404_PATTERNS.some((pattern) => reqUrl.includes(pattern));
}

/** メッセージが無視対象か */
function isBenignMessage(msg: string, patterns: string[]): boolean {
  return patterns.some((pattern) => msg.toLowerCase().includes(pattern.toLowerCase()));
}

// ──────────────────────────────────────────
// ページ監視ヘルパー
// ──────────────────────────────────────────

interface PageHealthResult {
  jsErrors: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
  failedApiRequests: { url: string; status: number }[];
  serverErrors: { url: string; status: number }[];
  pageStatus: number;
}

async function checkPageHealth(page: Page, targetUrl: string): Promise<PageHealthResult> {
  const result: PageHealthResult = {
    jsErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    failedApiRequests: [],
    serverErrors: [],
    pageStatus: 0,
  };

  // JS例外の監視
  page.on('pageerror', (err) => {
    if (!isBenignMessage(err.message, BENIGN_PAGEERROR_PATTERNS)) {
      result.jsErrors.push(err.message);
    }
  });

  // console.error / console.warn の監視
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !isBenignMessage(text, BENIGN_CONSOLE_PATTERNS)) {
      result.consoleErrors.push(text);
    }
    if (msg.type() === 'warning' && !isBenignMessage(text, BENIGN_CONSOLE_PATTERNS)) {
      result.consoleWarnings.push(text);
    }
  });

  // レスポンス監視（5xx + 同一オリジンAPI 404）
  page.on('response', (response) => {
    const status = response.status();
    const resUrl = response.url();

    // 5xx エラー
    if (status >= 500) {
      result.serverErrors.push({ url: resUrl, status });
    }

    // 同一オリジンAPI の 404
    if (status === 404 && isSameOriginApi(resUrl) && !isBenign404(resUrl)) {
      result.failedApiRequests.push({ url: resUrl, status });
    }
  });

  // Cookie設定
  await page.context().addCookies([
    {
      name: 'age-verified',
      value: 'true',
      domain: BASE_HOST,
      path: '/',
    },
  ]);

  // ページ遷移
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  result.pageStatus = response?.status() ?? 0;

  // ハイドレーション + 非同期APIコール完了待ち
  await page.waitForTimeout(5000);

  return result;
}

// ──────────────────────────────────────────
// テスト対象ページ一覧
// ──────────────────────────────────────────

const ALL_PAGES = [
  { name: 'Homepage', path: '/' },
  { name: 'Products', path: '/products' },
  { name: 'Actresses', path: '/actresses' },
  { name: 'Sales', path: '/sales' },
  { name: 'Discover', path: '/discover' },
  { name: 'Makers', path: '/makers' },
  { name: 'Rankings', path: '/lists/ranking' },
  { name: 'Best 2025', path: '/best/2025' },
  { name: 'Weekly Report', path: '/weekly-report' },
  { name: 'Birthdays', path: '/birthdays' },
  { name: 'Daily Pick', path: '/daily-pick' },
  { name: 'Compare', path: '/compare' },
  { name: 'Compare Performers', path: '/compare/performers' },
  { name: 'Settings', path: '/settings' },
  { name: 'Favorites', path: '/favorites' },
  { name: 'Watchlist', path: '/watchlist' },
  { name: 'Budget', path: '/budget' },
  { name: 'Diary', path: '/diary' },
  { name: 'Alerts', path: '/alerts' },
  { name: 'Profile', path: '/profile' },
  { name: 'Search Image', path: '/search/image' },
  { name: 'Search Semantic', path: '/search/semantic' },
];

// ──────────────────────────────────────────
// テスト実行
// ──────────────────────────────────────────

test.describe('Full Page Health Check - All Events', () => {
  for (const p of ALL_PAGES) {
    test(`${p.name} (${p.path})`, async ({ page }) => {
      const result = await checkPageHealth(page, url(p.path));

      // 1. ページ自体が5xxでない
      expect(result.pageStatus, `Page returned ${result.pageStatus}`).toBeLessThan(500);

      // 2. JS例外なし
      if (result.jsErrors.length > 0) {
        console.log(`[${p.name}] JS Errors:`, result.jsErrors);
      }
      expect(result.jsErrors, `JS errors: ${result.jsErrors.join('; ')}`).toHaveLength(0);

      // 3. 5xxネットワークエラーなし
      if (result.serverErrors.length > 0) {
        console.log(`[${p.name}] 5xx responses:`, result.serverErrors);
      }
      expect(result.serverErrors, `5xx: ${JSON.stringify(result.serverErrors)}`).toHaveLength(0);

      // 4. 同一オリジンAPI 404なし
      if (result.failedApiRequests.length > 0) {
        console.log(`[${p.name}] API 404s:`, result.failedApiRequests);
      }
      expect(result.failedApiRequests, `API 404: ${JSON.stringify(result.failedApiRequests)}`).toHaveLength(0);

      // 5. console.error なし（警告として出力、テスト失敗にはしない）
      if (result.consoleErrors.length > 0) {
        console.log(`[${p.name}] Console errors (non-blocking):`, result.consoleErrors);
      }

      // 6. console.warn サマリー（情報のみ）
      if (result.consoleWarnings.length > 0) {
        console.log(`[${p.name}] Console warnings: ${result.consoleWarnings.length}件`);
      }
    });
  }
});

test.describe('Full Page Health Check - Dynamic Pages', () => {
  test('Product detail page', async ({ page, request }) => {
    // ランキングAPIから実在のIDを取得
    const searchResp = await request.get(url('/api/ranking/products?limit=1'));
    test.skip(!searchResp.ok(), 'Could not fetch product ID');

    const data = await searchResp.json();
    const ranking = data.ranking || [];
    test.skip(ranking.length === 0, 'No products in ranking');

    const productId = ranking[0].productId || ranking[0].id;
    test.skip(!productId, 'No product ID found');

    const result = await checkPageHealth(page, url(`/products/${productId}`));

    expect(result.pageStatus).toBeLessThan(500);

    if (result.jsErrors.length > 0) console.log('[Product Detail] JS Errors:', result.jsErrors);
    expect(result.jsErrors).toHaveLength(0);

    if (result.serverErrors.length > 0) console.log('[Product Detail] 5xx:', result.serverErrors);
    expect(result.serverErrors).toHaveLength(0);

    if (result.failedApiRequests.length > 0) console.log('[Product Detail] API 404s:', result.failedApiRequests);
    expect(result.failedApiRequests).toHaveLength(0);

    if (result.consoleErrors.length > 0) {
      console.log('[Product Detail] Console errors (non-blocking):', result.consoleErrors);
    }
  });

  test('Actress detail page', async ({ page, request }) => {
    // 女優一覧APIから実在のIDを取得
    const searchResp = await request.get(url('/api/actresses?limit=12'));
    test.skip(!searchResp.ok(), 'Could not fetch actress ID');

    const data = await searchResp.json();
    const actresses = data.actresses || [];
    test.skip(actresses.length === 0, 'No actresses returned');

    const actressId = actresses[0].id;
    test.skip(!actressId, 'No actress ID found');

    const result = await checkPageHealth(page, url(`/actress/${actressId}`));

    expect(result.pageStatus).toBeLessThan(500);

    if (result.jsErrors.length > 0) console.log('[Actress Detail] JS Errors:', result.jsErrors);
    expect(result.jsErrors).toHaveLength(0);

    if (result.serverErrors.length > 0) console.log('[Actress Detail] 5xx:', result.serverErrors);
    expect(result.serverErrors).toHaveLength(0);

    if (result.failedApiRequests.length > 0) console.log('[Actress Detail] API 404s:', result.failedApiRequests);
    expect(result.failedApiRequests).toHaveLength(0);

    if (result.consoleErrors.length > 0) {
      console.log('[Actress Detail] Console errors (non-blocking):', result.consoleErrors);
    }
  });
});
