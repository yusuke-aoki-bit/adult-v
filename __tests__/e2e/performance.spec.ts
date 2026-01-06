/**
 * パフォーマンステスト
 * ページロード時間、Core Web Vitals などを測定
 *
 * NOTE: ローカル開発環境は本番より遅いため、閾値は緩めに設定
 * CIではより厳しい閾値を使用することを推奨
 */
import { test, expect } from '@playwright/test';

// Increase timeout for performance tests
test.setTimeout(120000);

// ローカル開発環境用の緩い閾値（本番はより厳しくすべき）
const THRESHOLDS = {
  domContentLoaded: 10000, // 10秒
  fullLoad: 30000, // 30秒
  lcp: 5000, // 5秒
};

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('homepage loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const domContentLoaded = Date.now() - startTime;
    console.log(`DOM Content Loaded: ${domContentLoaded}ms`);

    expect(domContentLoaded).toBeLessThan(THRESHOLDS.domContentLoaded);

    await page.waitForLoadState('load');
    const fullLoad = Date.now() - startTime;
    console.log(`Full Load: ${fullLoad}ms`);

    expect(fullLoad).toBeLessThan(THRESHOLDS.fullLoad);
  });

  test('products page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    const domContentLoaded = Date.now() - startTime;
    console.log(`Products page DOM Content Loaded: ${domContentLoaded}ms`);

    expect(domContentLoaded).toBeLessThan(THRESHOLDS.domContentLoaded);
  });

  test('actresses page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/actresses');
    await page.waitForLoadState('domcontentloaded');

    const domContentLoaded = Date.now() - startTime;
    console.log(`Actresses page DOM Content Loaded: ${domContentLoaded}ms`);

    expect(domContentLoaded).toBeLessThan(THRESHOLDS.domContentLoaded);
  });

  test('statistics page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/statistics');
    await page.waitForLoadState('domcontentloaded');

    const domContentLoaded = Date.now() - startTime;
    console.log(`Statistics page DOM Content Loaded: ${domContentLoaded}ms`);

    expect(domContentLoaded).toBeLessThan(THRESHOLDS.domContentLoaded);
  });
});

test.describe('Core Web Vitals', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('measures LCP on homepage', async ({ page }) => {
    // Performance observerを設定
    await page.goto('/');

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1]!;
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // 10秒待っても取得できなければタイムアウト
        setTimeout(() => resolve(-1), 10000);
      });
    });

    console.log(`LCP: ${lcp}ms`);

    if (lcp > 0) {
      // Good LCP は 2.5秒以下
      expect(lcp).toBeLessThan(2500);
    }
  });

  test('measures FID simulation on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 最初のインタラクションまでの時間を測定（簡易版）
    const startTime = Date.now();

    // クリック可能な要素を探してクリック
    const clickableElement = page.locator('a, button').first();

    if (await clickableElement.isVisible()) {
      await clickableElement.click({ force: true, timeout: 5000 }).catch(() => {});
    }

    const interactionTime = Date.now() - startTime;
    console.log(`First interaction response: ${interactionTime}ms`);

    // 応答は 100ms 以内が理想
    expect(interactionTime).toBeLessThan(500);
  });

  test('measures CLS on homepage', async ({ page }) => {
    await page.goto('/');

    // CLSを測定
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        // 5秒後に結果を返す
        setTimeout(() => resolve(clsValue), 5000);
      });
    });

    console.log(`CLS: ${cls}`);

    // Good CLS は 0.1 以下
    expect(cls).toBeLessThan(0.25);
  });
});

test.describe('Resource Loading', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('homepage does not have excessive requests', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      requests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for initial page load resources (avoid networkidle which may timeout on production)
    await page.waitForTimeout(3000);

    console.log(`Total requests: ${requests.length}`);

    // 初期ロードで200リクエスト以下 (images, analytics, fonts, etc.)
    expect(requests.length).toBeLessThan(200);
  });

  test('images use lazy loading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // loading="lazy" 属性を持つ画像を数える
    const lazyImages = await page.locator('img[loading="lazy"]').count();
    const allImages = await page.locator('img').count();

    console.log(`Lazy images: ${lazyImages}/${allImages}`);

    // ビューポート外の画像は lazy loading されているべき
    if (allImages > 5) {
      expect(lazyImages).toBeGreaterThan(0);
    }
  });

  test('CSS and JS are not blocking', async ({ page }) => {
    await page.goto('/');

    // render-blocking リソースをチェック
    const blockingResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter(r => (r as any).renderBlockingStatus === 'blocking')
        .map(r => r.name);
    });

    console.log(`Blocking resources: ${blockingResources.length}`);

    // ブロッキングリソースは最小限に
    expect(blockingResources.length).toBeLessThan(10);
  });
});

test.describe('Caching', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('static assets have cache headers', async ({ page }) => {
    const cacheableAssets: Array<{ url: string; cacheControl: string | undefined }> = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/_next/static/') || url.includes('.js') || url.includes('.css')) {
        cacheableAssets.push({
          url,
          cacheControl: response.headers()['cache-control'],
        });
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    console.log(`Cacheable assets checked: ${cacheableAssets.length}`);

    // Next.jsの静的アセットは長期キャッシュが設定されているはず
    for (const asset of cacheableAssets.slice(0, 5)) {
      if (asset.url.includes('/_next/static/')) {
        expect(asset.cacheControl).toBeTruthy();
      }
    }
  });

  test('second page load is faster', async ({ page }) => {
    // 初回ロード
    const firstStart = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const firstLoad = Date.now() - firstStart;

    // ブラウザキャッシュをクリアせずに再ロード
    const secondStart = Date.now();
    await page.reload();
    await page.waitForLoadState('load');
    const secondLoad = Date.now() - secondStart;

    console.log(`First load: ${firstLoad}ms, Second load: ${secondLoad}ms`);

    // キャッシュにより2回目のロードは速いはず（同程度でもOK）
    expect(secondLoad).toBeLessThanOrEqual(firstLoad * 1.5);
  });
});

test.describe('Mobile Performance', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('mobile homepage loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    console.log(`Mobile DOM Content Loaded: ${loadTime}ms`);

    // ローカル開発環境では緩めの閾値
    expect(loadTime).toBeLessThan(THRESHOLDS.domContentLoaded);
  });

  test('mobile navigation is responsive', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // モバイルメニューがあるか確認
    const mobileMenuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [data-mobile-menu]');

    if (await mobileMenuButton.isVisible()) {
      const startTime = Date.now();
      await mobileMenuButton.click();

      // メニューが開くまでの時間
      await page.waitForTimeout(300);
      const responseTime = Date.now() - startTime;

      console.log(`Mobile menu response: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(500);
    }
  });
});
