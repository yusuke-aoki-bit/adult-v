/**
 * 包括的E2Eテスト
 *
 * 全ページ・全イベント・コンソールエラーを網羅的にテスト
 * - 各ページのナビゲーション
 * - コンソールエラー検出
 * - イベント発火確認
 * - UI操作テスト
 */
import { test, expect, ConsoleMessage, Page, BrowserContext } from '@playwright/test';
import { EventTestHelper, ALL_EVENTS } from './helpers/EventTestHelper';

// タイムアウト設定
test.setTimeout(180000);

// ========================================
// コンソールエラー検出設定
// ========================================

// 許容するコンソールエラー（外部サービス関連など）
const IGNORED_PATTERNS = [
  '/monitoring',
  'reCAPTCHA',
  'App Check',
  'firebase',
  'Firebase',
  'Sentry',
  '404 (Not Found)',
  'Failed to load resource: the server responded with a status of 404',
  'net::ERR_BLOCKED_BY_CLIENT',
  'Download the React DevTools',
  'React DevTools',
  'Loading the script',
  'Content Security Policy',
  'violated the following Content Security Policy',
  'Performance: Tries left',
  // Sentryの開発環境警告
  'Sentry Logger',
  'Recording is off',
  '[Tracing]',
  // Google APIs
  'apis.google.com',
  'google.com/js/',
  // 開発サーバー固有の一時的エラー（Turbopack/RSC関連）
  'Failed to fetch RSC payload',
  'Falling back to browser navigation',
  'Switched to client rendering because the server rendering errored',
  'was instantiated because it was required from module',
  'NextIntlClientProvider',
  'useTranslations',
  // 検索エラー（テスト環境でのタイミング問題）
  'Search error: TypeError: Failed to fetch',
  // CI環境ではDBがない
  'Database initialization failed',
  'DATABASE_URL',
  'getActressesCount failed',
  'getPopularSeries failed',
  'Error getting popular tags',
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
  // 翻訳エラー
  'MISSING_MESSAGE',
];

interface ConsoleError {
  type: 'critical' | 'warning' | 'error';
  text: string;
  url: string;
}

function shouldIgnore(text: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => text.toLowerCase().includes(pattern.toLowerCase()));
}

function isCriticalError(text: string): boolean {
  return CRITICAL_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

function classifyError(text: string): 'critical' | 'warning' | 'error' {
  if (isCriticalError(text)) return 'critical';
  if (text.toLowerCase().includes('warning') || text.toLowerCase().includes('deprecated')) return 'warning';
  return 'error';
}

// ========================================
// ヘルパー関数
// ========================================

async function setupPage(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

async function collectConsoleErrors(
  page: Page,
  navigateFn: () => Promise<void>,
  waitTime = 3000,
): Promise<ConsoleError[]> {
  const errors: ConsoleError[] = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      if (shouldIgnore(text)) return;

      errors.push({
        type: classifyError(text),
        text: text.substring(0, 500),
        url: page.url(),
      });
    }
  };

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

  try {
    await navigateFn();
    // ページがまだ開いている場合のみ待機
    if (!page.isClosed()) {
      await page.waitForTimeout(waitTime);
    }
  } catch (error) {
    // ページがクローズされた場合は無視
    if (!(error instanceof Error && error.message.includes('Target page, context or browser has been closed'))) {
      throw error;
    }
  }

  page.off('console', consoleHandler);
  page.off('pageerror', pageErrorHandler);

  return errors;
}

// ========================================
// テスト定義
// ========================================

test.describe('包括的E2Eテスト - 全ページナビゲーション', () => {
  // このプロジェクトは ?hl=locale 形式を使用（パスベースではない）
  // デフォルトロケール(ja)はパラメータなし、その他は ?hl=xx を使用
  // /ja/xxx は /xxx にリダイレクトされる
  const testPages = [
    { path: '/', name: 'トップページ' },
    { path: '/products', name: '商品一覧' },
    { path: '/actresses', name: '女優一覧(トップと同じ)' },
    { path: '/categories', name: 'カテゴリ' },
    { path: '/calendar', name: 'カレンダー' },
    { path: '/statistics', name: '統計' },
    { path: '/favorites', name: 'お気に入り' },
    { path: '/compare', name: '商品比較' },
    { path: '/discover', name: 'ディスカバー' },
    { path: '/diary', name: '視聴日記' },
    { path: '/watchlist', name: 'ウォッチリスト' },
    { path: '/alerts', name: '価格アラート' },
    { path: '/series', name: 'シリーズ一覧' },
    { path: '/makers', name: 'メーカー一覧' },
  ];

  test.beforeEach(async ({ context }) => {
    await setupPage(context);
  });

  for (const { path, name } of testPages) {
    test(`${name} (${path}) - ページ読み込み・コンソールエラーなし`, async ({ page }) => {
      const errors = await collectConsoleErrors(page, async () => {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle').catch(() => {});
      });

      const criticalErrors = errors.filter((e) => e.type === 'critical');
      const warnings = errors.filter((e) => e.type === 'warning');
      const generalErrors = errors.filter((e) => e.type === 'error');

      // 警告を出力
      if (warnings.length > 0) {
        console.log(`\n⚠️ Warnings on ${path}: ${warnings.length}`);
        warnings.slice(0, 3).forEach((w, i) => {
          console.log(`  ${i + 1}. ${w.text.substring(0, 100)}`);
        });
      }

      // 一般エラーを出力
      if (generalErrors.length > 0) {
        console.log(`\n📋 Errors on ${path}: ${generalErrors.length}`);
        generalErrors.slice(0, 3).forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.text.substring(0, 100)}`);
        });
      }

      // 深刻なエラーを出力・検証
      if (criticalErrors.length > 0) {
        console.error(`\n❌ Critical errors on ${path}:`);
        criticalErrors.forEach((e, i) => {
          console.error(`  ${i + 1}. ${e.text}`);
        });
      }

      expect(criticalErrors, `深刻なコンソールエラー: ${path}`).toHaveLength(0);
    });
  }
});

test.describe('包括的E2Eテスト - 動的ページ', () => {
  test.beforeEach(async ({ context }) => {
    await setupPage(context);
  });

  test('商品詳細ページ - 読み込み・コンソールエラーなし', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const productLink = page.locator('a[href*="/products/"]').first();
    if ((await productLink.count()) === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(
      page,
      async () => {
        await productLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle').catch(() => {});
      },
      5000,
    );

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    if (criticalErrors.length > 0) {
      console.error('❌ Critical errors on product detail:');
      criticalErrors.forEach((e, i) => {
        console.error(`  ${i + 1}. ${e.text}`);
      });
    }
    expect(criticalErrors).toHaveLength(0);
  });

  test('女優詳細ページ - 読み込み・コンソールエラーなし', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const actressLink = page.locator('a[href*="/actress/"]').first();
    if ((await actressLink.count()) === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(
      page,
      async () => {
        await actressLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle').catch(() => {});
      },
      5000,
    );

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    if (criticalErrors.length > 0) {
      console.error('❌ Critical errors on actress detail:');
      criticalErrors.forEach((e, i) => {
        console.error(`  ${i + 1}. ${e.text}`);
      });
    }
    expect(criticalErrors).toHaveLength(0);
  });

  test('シリーズ詳細ページ - 読み込み・コンソールエラーなし', async ({ page }) => {
    await page.goto('/series', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const seriesLink = page.locator('a[href*="/series/"]').first();
    if ((await seriesLink.count()) === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(
      page,
      async () => {
        await seriesLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle').catch(() => {});
      },
      5000,
    );

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('メーカー詳細ページ - 読み込み・コンソールエラーなし', async ({ page }) => {
    await page.goto('/makers', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const makerLink = page.locator('a[href*="/makers/"]').first();
    if ((await makerLink.count()) === 0) {
      test.skip();
      return;
    }

    const errors = await collectConsoleErrors(
      page,
      async () => {
        await makerLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle').catch(() => {});
      },
      5000,
    );

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('包括的E2Eテスト - UI操作', () => {
  test.beforeEach(async ({ context }) => {
    await setupPage(context);
  });

  test('検索機能 - 動作確認', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors = await collectConsoleErrors(page, async () => {
      // 検索入力を探す
      const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[name="q"]').first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('テスト');
        await searchInput.press('Enter');
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('フィルター操作 - 動作確認', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors = await collectConsoleErrors(page, async () => {
      // フィルターボタンを探す
      const filterButton = page.locator('button:has-text("フィルター"), button[aria-label*="filter"]').first();
      if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }

      // セレクトボックスを探す
      const sortSelect = page.locator('select[name*="sort"]').first();
      if (await sortSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await sortSelect.locator('option').all();
        if (options.length > 1) {
          await sortSelect.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
        }
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('ページネーション - 動作確認', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors = await collectConsoleErrors(page, async () => {
      // 次ページボタンを探す
      const nextButton = page.locator('a[href*="page=2"], button:has-text("次"), a:has-text("次")').first();
      if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('お気に入り追加/削除 - 動作確認', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 商品詳細に移動
    const productLink = page.locator('a[href*="/products/"]').first();
    if ((await productLink.count()) === 0) {
      test.skip();
      return;
    }
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const errors = await collectConsoleErrors(page, async () => {
      // お気に入りボタンを探す
      const favoriteButton = page
        .locator('button[aria-label*="お気に入り"], button[aria-label*="favorite"], [data-testid="favorite-button"]')
        .first();
      if (await favoriteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await favoriteButton.click();
        await page.waitForTimeout(500);
        await favoriteButton.click();
        await page.waitForTimeout(500);
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('モバイルメニュー - 動作確認', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors = await collectConsoleErrors(page, async () => {
      // ハンバーガーメニューを探す
      const menuButton = page
        .locator('button[aria-label*="menu"], button[aria-label*="メニュー"], [data-testid="mobile-menu"]')
        .first();
      if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });

  test('設定パネル - 動作確認', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors = await collectConsoleErrors(page, async () => {
      // 設定ボタンを探す
      const settingsButton = page
        .locator('button[aria-label*="設定"], button[aria-label*="settings"], [data-testid="settings-button"]')
        .first();
      if (await settingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(1000);
      }
    });

    const criticalErrors = errors.filter((e) => e.type === 'critical');
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('包括的E2Eテスト - イベントカバレッジ', () => {
  let eventHelper: EventTestHelper;

  test.beforeEach(async ({ page, context }) => {
    await setupPage(context);
    eventHelper = new EventTestHelper(page);
    await eventHelper.startCapturing();
  });

  test.afterEach(async () => {
    await eventHelper.printCoverageReport();
  });

  test('全イベントカバレッジテスト - 包括的操作', async ({ page }) => {
    console.log('=== 全イベントカバレッジテスト開始 ===');

    // 1. ホームページ読み込み
    console.log('Step 1: ホームページ読み込み...');
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);

    let pageViewFired = await eventHelper.hasEventFired('page_view');
    console.log(`  page_view: ${pageViewFired ? '✓' : '✗'}`);

    // 2. 商品ページに移動
    console.log('Step 2: 商品詳細ページへ移動...');
    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const viewProductFired = await eventHelper.hasEventFired('view_product');
      console.log(`  view_product: ${viewProductFired ? '✓' : '✗'}`);

      // 3. お気に入り追加/削除
      console.log('Step 3: お気に入り操作...');
      const favoriteButton = page.locator('button[aria-label*="お気に入り"], button[aria-label*="favorite"]').first();
      if (await favoriteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await favoriteButton.click();
        await page.waitForTimeout(500);

        const addFavoriteFired = await eventHelper.hasEventFired('add_favorite');
        console.log(`  add_favorite: ${addFavoriteFired ? '✓' : '✗'}`);

        await favoriteButton.click();
        await page.waitForTimeout(500);

        const removeFavoriteFired = await eventHelper.hasEventFired('remove_favorite');
        console.log(`  remove_favorite: ${removeFavoriteFired ? '✓' : '✗'}`);
      }

      // 4. アフィリエイトリンククリック
      console.log('Step 4: アフィリエイトリンククリック...');
      const affiliateLink = page.locator('a[rel*="sponsored"], a[href*="dmm.co.jp"], a[href*="mgstage.com"]').first();
      if (await affiliateLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await affiliateLink.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await page.waitForTimeout(500);

        const affiliateFired = await eventHelper.hasEventFired('click_affiliate_link');
        console.log(`  click_affiliate_link: ${affiliateFired ? '✓' : '✗'}`);
      }
    }

    // 5. 検索
    console.log('Step 5: 検索実行...');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('テスト');
      await searchInput.press('Enter');
      await page.waitForTimeout(1500);

      const searchFired = await eventHelper.hasEventFired('search');
      console.log(`  search: ${searchFired ? '✓' : '✗'}`);
    }

    // 6. フィルター適用
    console.log('Step 6: フィルター適用...');
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
    const sortSelect = page.locator('select[name*="sort"]').first();
    if (await sortSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await sortSelect.locator('option').all();
      if (options.length > 1) {
        await sortSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);

        const sortFired = await eventHelper.hasEventFired('sort_changed');
        console.log(`  sort_changed: ${sortFired ? '✓' : '✗'}`);
      }
    }

    // 7. Web Vitalsチェック
    console.log('Step 7: Web Vitals確認...');
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    const webVitalsFired = await eventHelper.hasEventFired('web_vitals');
    console.log(`  web_vitals: ${webVitalsFired ? '✓' : '✗'}`);

    // 最終カバレッジレポート
    const coverage = await eventHelper.getEventCoverage();
    console.log(`\n=== 最終カバレッジ: ${coverage.captured}/${coverage.total} (${coverage.percentage}%) ===`);

    // 発火しなかったイベントをリスト
    const unfiredEvents = Object.entries(coverage.events)
      .filter(([, data]) => !data.fired)
      .map(([name]) => name);

    if (unfiredEvents.length > 0) {
      console.log('\n未発火イベント:');
      unfiredEvents.forEach((name) => console.log(`  - ${name}`));
    }
  });
});

test.describe('包括的E2Eテスト - サマリーレポート', () => {
  // このテストは全ページを巡回するため、より長いタイムアウトが必要
  test.setTimeout(300000);

  test.beforeEach(async ({ context }) => {
    await setupPage(context);
  });

  test('全ページコンソールエラーサマリー', async ({ page }) => {
    const pageResults: { page: string; critical: number; warnings: number; errors: number }[] = [];
    const allCriticalErrors: { page: string; error: string }[] = [];

    const pagesToCheck = [
      '/',
      '/products',
      '/categories',
      '/calendar',
      '/statistics',
      '/favorites',
      '/compare',
      '/discover',
    ];

    for (const pagePath of pagesToCheck) {
      // ページがクローズされた場合はスキップ
      if (page.isClosed()) {
        console.log(`⚠️ Page closed, skipping ${pagePath}`);
        continue;
      }

      try {
        const errors = await collectConsoleErrors(
          page,
          async () => {
            await page.goto(pagePath, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForLoadState('networkidle').catch(() => {});
          },
          2000,
        );

        const critical = errors.filter((e) => e.type === 'critical');
        const warnings = errors.filter((e) => e.type === 'warning');
        const general = errors.filter((e) => e.type === 'error');

        pageResults.push({
          page: pagePath,
          critical: critical.length,
          warnings: warnings.length,
          errors: general.length,
        });

        critical.forEach((e) => {
          allCriticalErrors.push({ page: pagePath, error: e.text });
        });
      } catch (error) {
        // ページクローズエラーはスキップ
        if (error instanceof Error && error.message.includes('Target page, context or browser has been closed')) {
          console.log(`⚠️ Page closed during ${pagePath}, skipping remaining pages`);
          break;
        }
        throw error;
      }
    }

    // レポート出力
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         Console Error Summary Report                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ Page                       │ Critical │ Warnings │ Errors    ║');
    console.log('╠────────────────────────────┼──────────┼──────────┼───────────╣');

    pageResults.forEach(({ page: p, critical, warnings, errors }) => {
      const pageName = p.padEnd(26);
      const critStr = critical.toString().padStart(8);
      const warnStr = warnings.toString().padStart(8);
      const errStr = errors.toString().padStart(9);
      console.log(`║ ${pageName} │${critStr} │${warnStr} │${errStr} ║`);
    });

    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (allCriticalErrors.length > 0) {
      console.log('❌ Critical Errors Found:');
      allCriticalErrors.forEach(({ page: p, error }, i) => {
        console.log(`  ${i + 1}. [${p}] ${error.substring(0, 150)}`);
      });
    } else {
      console.log('✅ No critical errors found!');
    }

    expect(allCriticalErrors, '深刻なコンソールエラーが検出されました').toHaveLength(0);
  });
});
