/**
 * ブラウザコンソールエラー検出テスト
 *
 * 開発者コンソールに出力されるすべてのエラーを検出
 * - JavaScript実行エラー
 * - React/Next.jsエラー
 * - ネットワークエラー
 * - 非推奨API使用警告
 */
import { test, expect, ConsoleMessage, Page } from '@playwright/test';

// 許容するコンソールエラー（外部サービス関連など）
const IGNORED_PATTERNS = [
  '/monitoring',
  'reCAPTCHA',
  'App Check',
  'firebase',
  'Sentry',
  '404 (Not Found)',
  'Failed to load resource: the server responded with a status of 404',
  'net::ERR_BLOCKED_BY_CLIENT', // 広告ブロッカー関連
  'Download the React DevTools',
  'React DevTools',
];

// 深刻なエラーパターン（テスト失敗の原因）
const CRITICAL_ERROR_PATTERNS = [
  // React関連
  'Hydration failed',
  'Text content does not match',
  'did not match',
  'Minified React error',
  'Invalid hook call',
  'Cannot update a component',
  'Maximum update depth exceeded',
  'Each child in a list should have a unique',

  // Next.js関連
  'Unhandled Runtime Error',
  'Error: Invariant',
  'ChunkLoadError',

  // JavaScript一般
  'TypeError:',
  'ReferenceError:',
  'SyntaxError:',
  'Uncaught',
  'undefined is not',
  'null is not',
  'Cannot read propert',
  'is not a function',
  'is not defined',
];

// 警告パターン（ログ出力するが失敗しない）
const WARNING_PATTERNS = [
  'Warning:',
  'Deprecation',
  'deprecated',
  'will be removed',
  'is deprecated',
];

interface ConsoleError {
  type: 'critical' | 'warning' | 'error';
  text: string;
  url: string;
  location?: string;
}

function shouldIgnore(text: string): boolean {
  return IGNORED_PATTERNS.some(pattern =>
    text.toLowerCase().includes(pattern.toLowerCase())
  );
}

function isCriticalError(text: string): boolean {
  return CRITICAL_ERROR_PATTERNS.some(pattern =>
    text.includes(pattern)
  );
}

function isWarning(text: string): boolean {
  return WARNING_PATTERNS.some(pattern =>
    text.toLowerCase().includes(pattern.toLowerCase())
  );
}

function classifyError(text: string): 'critical' | 'warning' | 'error' {
  if (isCriticalError(text)) return 'critical';
  if (isWarning(text)) return 'warning';
  return 'error';
}

async function collectConsoleErrors(
  page: Page,
  navigateFn: () => Promise<void>
): Promise<ConsoleError[]> {
  const errors: ConsoleError[] = [];

  // コンソールメッセージを監視
  const consoleHandler = (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();

      if (shouldIgnore(text)) return;

      errors.push({
        type: classifyError(text),
        text: text.substring(0, 500),
        url: page.url(),
        location: msg.location()?.url,
      });
    }
  };

  // ページエラーを監視
  const pageErrorHandler = (error: Error) => {
    const text = error.message;
    if (shouldIgnore(text)) return;

    errors.push({
      type: 'critical',
      text: text.substring(0, 500),
      url: page.url(),
    });
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);

  await navigateFn();

  // Hydration完了を待機
  await page.waitForTimeout(2000);

  page.off('console', consoleHandler);
  page.off('pageerror', pageErrorHandler);

  return errors;
}

test.describe('Console Error Detection', () => {
  // テスト対象ページ
  const testPages = [
    { path: '/', name: 'トップページ' },
    { path: '/ja/products', name: '商品一覧' },
    { path: '/ja/actresses', name: '女優一覧' },
    { path: '/ja/categories', name: 'カテゴリ' },
    { path: '/ja/calendar', name: 'カレンダー' },
    { path: '/ja/favorites', name: 'お気に入り' },
    { path: '/ja/compare', name: '商品比較' },
    { path: '/ja/discover', name: 'ディスカバー' },
    { path: '/ja/statistics', name: '統計' },
    { path: '/ja/diary', name: '視聴日記' },
    { path: '/ja/watchlist', name: 'ウォッチリスト' },
    { path: '/ja/alerts', name: '価格アラート' },
  ];

  for (const { path, name } of testPages) {
    test(`${name} (${path}) - コンソールエラーなし`, async ({ page }) => {
      const errors = await collectConsoleErrors(page, async () => {
        await page.goto(path, { waitUntil: 'networkidle' });
      });

      const criticalErrors = errors.filter(e => e.type === 'critical');
      const warnings = errors.filter(e => e.type === 'warning');
      const generalErrors = errors.filter(e => e.type === 'error');

      // 警告を出力（失敗しない）
      if (warnings.length > 0) {
        console.log(`\n⚠️ Warnings on ${path}:`);
        warnings.forEach((w, i) => {
          console.log(`  ${i + 1}. ${w.text.substring(0, 100)}...`);
        });
      }

      // 一般エラーを出力
      if (generalErrors.length > 0) {
        console.log(`\n📋 Errors on ${path}:`);
        generalErrors.forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.text.substring(0, 100)}...`);
        });
      }

      // 深刻なエラーがあればテスト失敗
      if (criticalErrors.length > 0) {
        console.error(`\n❌ Critical errors on ${path}:`);
        criticalErrors.forEach((e, i) => {
          console.error(`  ${i + 1}. ${e.text}`);
        });
      }

      expect(
        criticalErrors,
        `深刻なコンソールエラーが検出されました: ${path}`
      ).toHaveLength(0);
    });
  }
});

test.describe('Dynamic Page Console Errors', () => {
  test('商品詳細ページ - コンソールエラーなし', async ({ page }) => {
    // まず商品一覧から商品を取得
    await page.goto('/ja/products', { waitUntil: 'networkidle' });

    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.count() === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(page, async () => {
      await productLink.click();
      await page.waitForLoadState('networkidle');
    });

    const criticalErrors = errors.filter(e => e.type === 'critical');
    expect(
      criticalErrors,
      '商品詳細ページで深刻なエラーが検出されました'
    ).toHaveLength(0);
  });

  test('女優詳細ページ - コンソールエラーなし', async ({ page }) => {
    await page.goto('/ja/actresses', { waitUntil: 'networkidle' });

    const actressLink = page.locator('a[href*="/actress/"]').first();
    if (await actressLink.count() === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(page, async () => {
      await actressLink.click();
      await page.waitForLoadState('networkidle');
    });

    const criticalErrors = errors.filter(e => e.type === 'critical');
    expect(
      criticalErrors,
      '女優詳細ページで深刻なエラーが検出されました'
    ).toHaveLength(0);
  });
});

test.describe('User Interaction Console Errors', () => {
  test('検索操作 - コンソールエラーなし', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const errors = await collectConsoleErrors(page, async () => {
      // 検索ボックスを探してクリック
      const searchButton = page.locator('[data-testid="search-button"], button:has-text("検索"), input[type="search"]').first();
      if (await searchButton.count() > 0) {
        await searchButton.click();
        await page.waitForTimeout(500);
      }
    });

    const criticalErrors = errors.filter(e => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('モバイルメニュー操作 - コンソールエラーなし', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const errors = await collectConsoleErrors(page, async () => {
      // ハンバーガーメニューを探してクリック
      const menuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], button[aria-label*="メニュー"]').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(500);
      }
    });

    const criticalErrors = errors.filter(e => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('ダークモード切替 - コンソールエラーなし', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const errors = await collectConsoleErrors(page, async () => {
      // テーマ切替ボタンを探してクリック
      const themeButton = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="テーマ"]').first();
      if (await themeButton.count() > 0) {
        await themeButton.click();
        await page.waitForTimeout(500);
      }
    });

    const criticalErrors = errors.filter(e => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Console Error Report', () => {
  test('全ページエラーサマリー', async ({ page }) => {
    const pageResults: { page: string; critical: number; warnings: number; errors: number }[] = [];
    const allCriticalErrors: { page: string; error: string }[] = [];

    const pagesToCheck = [
      '/',
      '/ja/products',
      '/ja/actresses',
      '/ja/categories',
      '/ja/calendar',
      '/ja/statistics',
    ];

    for (const pagePath of pagesToCheck) {
      const errors = await collectConsoleErrors(page, async () => {
        await page.goto(pagePath, { waitUntil: 'networkidle' });
      });

      const critical = errors.filter(e => e.type === 'critical');
      const warnings = errors.filter(e => e.type === 'warning');
      const general = errors.filter(e => e.type === 'error');

      pageResults.push({
        page: pagePath,
        critical: critical.length,
        warnings: warnings.length,
        errors: general.length,
      });

      critical.forEach(e => {
        allCriticalErrors.push({ page: pagePath, error: e.text });
      });
    }

    // レポート出力
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║          Console Error Summary Report                 ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║ Page                    │ Critical │ Warnings │ Errors ║');
    console.log('╠─────────────────────────┼──────────┼──────────┼────────╣');

    pageResults.forEach(({ page: p, critical, warnings, errors }) => {
      const pageName = p.padEnd(23);
      const critStr = critical.toString().padStart(8);
      const warnStr = warnings.toString().padStart(8);
      const errStr = errors.toString().padStart(6);
      console.log(`║ ${pageName} │${critStr} │${warnStr} │${errStr} ║`);
    });

    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (allCriticalErrors.length > 0) {
      console.log('❌ Critical Errors Found:');
      allCriticalErrors.forEach(({ page: p, error }, i) => {
        console.log(`  ${i + 1}. [${p}] ${error.substring(0, 150)}...`);
      });
    }

    // 深刻なエラーがあれば失敗
    expect(
      allCriticalErrors,
      '深刻なコンソールエラーが検出されました'
    ).toHaveLength(0);
  });
});
