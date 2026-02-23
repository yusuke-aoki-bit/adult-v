/**
 * Hydrationエラー検出テスト
 *
 * React Hydrationエラーをコンソール監視で検出する
 * SSRとクライアントのHTML不一致を早期発見
 */
import { test, expect, ConsoleMessage } from '@playwright/test';

// 検出するエラーパターン
const HYDRATION_ERROR_PATTERNS = [
  'Hydration failed',
  'Text content does not match',
  'did not match',
  'server rendered HTML',
  'Minified React error #418',
  'Minified React error #423',
  'Minified React error #425',
];

// 許容するコンソールエラー（外部サービス関連など）
const IGNORED_ERRORS = [
  '/monitoring',
  'reCAPTCHA',
  'App Check',
  'firebase',
  'Sentry',
  '404 (Not Found)', // Sentry monitoring endpoint
];

interface ConsoleError {
  type: string;
  text: string;
  url: string;
}

function isHydrationError(text: string): boolean {
  return HYDRATION_ERROR_PATTERNS.some((pattern) => text.toLowerCase().includes(pattern.toLowerCase()));
}

function shouldIgnoreError(text: string): boolean {
  return IGNORED_ERRORS.some((pattern) => text.toLowerCase().includes(pattern.toLowerCase()));
}

test.describe('Hydration Error Detection', () => {
  // テスト対象ページ
  const pages = [
    { path: '/', name: 'トップページ' },
    { path: '/ja/products', name: '商品一覧' },
    { path: '/ja/actresses', name: '女優一覧' },
    { path: '/ja/categories', name: 'カテゴリ' },
    { path: '/ja/calendar', name: 'カレンダー' },
    { path: '/ja/favorites', name: 'お気に入り' },
    { path: '/ja/diary', name: '視聴日記' },
    { path: '/ja/discover', name: 'ディスカバー' },
  ];

  for (const { path, name } of pages) {
    test(`${name} (${path}) - Hydrationエラーなし`, async ({ page }) => {
      const consoleErrors: ConsoleError[] = [];
      const hydrationErrors: ConsoleError[] = [];

      // コンソールメッセージを監視
      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const error: ConsoleError = {
            type: msg.type(),
            text: text,
            url: page.url(),
          };

          // 無視するエラーをスキップ
          if (shouldIgnoreError(text)) {
            return;
          }

          consoleErrors.push(error);

          // Hydrationエラーを特別にチェック
          if (isHydrationError(text)) {
            hydrationErrors.push(error);
          }
        }
      });

      // ページ読み込みエラーを監視
      page.on('pageerror', (error) => {
        const text = error.message;
        if (!shouldIgnoreError(text) && isHydrationError(text)) {
          hydrationErrors.push({
            type: 'pageerror',
            text: text,
            url: page.url(),
          });
        }
      });

      // ページにアクセス
      await page.goto(path, { waitUntil: 'networkidle' });

      // 少し待機してHydrationが完了するのを待つ
      await page.waitForTimeout(2000);

      // Hydrationエラーがないことを確認
      if (hydrationErrors.length > 0) {
        console.error('Hydration errors detected:');
        hydrationErrors.forEach((err, i) => {
          console.error(`  ${i + 1}. ${err.text.substring(0, 200)}...`);
        });
      }

      expect(hydrationErrors, `Hydrationエラーが検出されました: ${path}`).toHaveLength(0);
    });
  }

  test('商品詳細ページ - Hydrationエラーなし', async ({ page }) => {
    const hydrationErrors: ConsoleError[] = [];

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!shouldIgnoreError(text) && isHydrationError(text)) {
          hydrationErrors.push({
            type: msg.type(),
            text: text,
            url: page.url(),
          });
        }
      }
    });

    // まず商品一覧から商品IDを取得
    await page.goto('/ja/products', { waitUntil: 'networkidle' });

    // 商品カードのリンクを取得
    const productLink = page.locator('a[href*="/products/"]').first();

    if ((await productLink.count()) > 0) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      expect(hydrationErrors, '商品詳細でHydrationエラーが検出されました').toHaveLength(0);
    }
  });

  test('女優詳細ページ - Hydrationエラーなし', async ({ page }) => {
    const hydrationErrors: ConsoleError[] = [];

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!shouldIgnoreError(text) && isHydrationError(text)) {
          hydrationErrors.push({
            type: msg.type(),
            text: text,
            url: page.url(),
          });
        }
      }
    });

    // まず女優一覧から女優IDを取得
    await page.goto('/ja/actresses', { waitUntil: 'networkidle' });

    // 女優カードのリンクを取得
    const actressLink = page.locator('a[href*="/actress/"]').first();

    if ((await actressLink.count()) > 0) {
      await actressLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      expect(hydrationErrors, '女優詳細でHydrationエラーが検出されました').toHaveLength(0);
    }
  });
});

test.describe('Console Error Summary', () => {
  test('全ページのコンソールエラー総チェック', async ({ page }) => {
    const allErrors: { page: string; errors: string[] }[] = [];
    const pagesToCheck = ['/', '/ja/products', '/ja/actresses', '/ja/categories'];

    for (const pagePath of pagesToCheck) {
      const pageErrors: string[] = [];

      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!shouldIgnoreError(text)) {
            pageErrors.push(text.substring(0, 100));
          }
        }
      });

      await page.goto(pagePath, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      if (pageErrors.length > 0) {
        allErrors.push({ page: pagePath, errors: [...pageErrors] });
      }

      // リスナーをクリア（新しいページ用）
      page.removeAllListeners('console');
    }

    // サマリーを出力
    if (allErrors.length > 0) {
      console.log('\n=== Console Error Summary ===');
      allErrors.forEach(({ page: p, errors }) => {
        console.log(`\n${p}:`);
        errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}...`));
      });
      console.log('\n=============================\n');
    }

    // Hydrationエラーがあればテスト失敗
    const hasHydrationErrors = allErrors.some(({ errors }) => errors.some((e) => isHydrationError(e)));

    expect(hasHydrationErrors, 'Hydrationエラーが検出されました').toBe(false);
  });
});
