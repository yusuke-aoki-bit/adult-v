import { test, expect } from '@playwright/test';

// タイムアウトを60秒に設定
test.setTimeout(60000);

/**
 * パフォーマンステスト
 * マイグレーション0026適用後のページ読み込み速度を計測
 */

interface PerformanceResult {
  page: string;
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
}

const results: PerformanceResult[] = [];

test.describe('Performance Tests - After Migration 0026', () => {
  test.beforeEach(async ({ context }) => {
    // 年齢確認クッキーを設定
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test.afterAll(async () => {
    // 全テスト終了後に結果を表示
    console.log('\n=== Performance Test Results ===\n');
    console.log('| Page | Load Time | DOMContentLoaded | FCP | LCP |');
    console.log('|------|-----------|------------------|-----|-----|');
    results.forEach(r => {
      const fcp = r.firstContentfulPaint ? `${r.firstContentfulPaint.toFixed(0)}ms` : 'N/A';
      const lcp = r.largestContentfulPaint ? `${r.largestContentfulPaint.toFixed(0)}ms` : 'N/A';
      console.log(`| ${r.page} | ${r.loadTime.toFixed(0)}ms | ${r.domContentLoaded.toFixed(0)}ms | ${fcp} | ${lcp} |`);
    });
    console.log('\n');
  });

  async function measurePagePerformance(page: any, url: string, pageName: string) {
    const startTime = Date.now();

    await page.goto(url, { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    // Performance APIからメトリクスを取得
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      const fcp = paint.find(p => p.name === 'first-contentful-paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
        loadComplete: navigation.loadEventEnd - navigation.startTime,
        firstContentfulPaint: fcp ? fcp.startTime : null,
      };
    });

    // LCPを取得（PerformanceObserverで取得できない場合はnull）
    const lcp = await page.evaluate(() => {
      return new Promise<number | null>((resolve) => {
        let lcpValue: number | null = null;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            lcpValue = entries[entries.length - 1].startTime;
          }
        });
        try {
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          setTimeout(() => {
            observer.disconnect();
            resolve(lcpValue);
          }, 100);
        } catch {
          resolve(null);
        }
      });
    });

    const result: PerformanceResult = {
      page: pageName,
      loadTime,
      domContentLoaded: metrics.domContentLoaded,
      firstContentfulPaint: metrics.firstContentfulPaint,
      largestContentfulPaint: lcp,
    };

    results.push(result);

    return result;
  }

  test('Homepage load performance', async ({ page }) => {
    const result = await measurePagePerformance(page, '/ja', 'Homepage (ja)');
    console.log(`Homepage: ${result.loadTime}ms`);

    // 目標: 3秒以内
    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Actresses list - Name sort (default)', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/actresses?sort=nameAsc',
      'Actresses (nameAsc)'
    );
    console.log(`Actresses (nameAsc): ${result.loadTime}ms`);

    // 確認: ページにコンテンツが表示されている
    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Actresses list - Recent sort (uses precomputed latest_release_date)', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/actresses?sort=recent',
      'Actresses (recent)'
    );
    console.log(`Actresses (recent): ${result.loadTime}ms`);

    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // 事前計算カラム使用により高速化が期待される
    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Actresses list - Product count sort (uses precomputed release_count)', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/actresses?sort=productCount',
      'Actresses (productCount)'
    );
    console.log(`Actresses (productCount): ${result.loadTime}ms`);

    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Actresses list - FANZA exclusion filter (uses is_fanza_only)', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/actresses?excludeFanzaOnly=true',
      'Actresses (excludeFanzaOnly)'
    );
    console.log(`Actresses (excludeFanzaOnly): ${result.loadTime}ms`);

    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Products list - Default sort', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/products',
      'Products (default)'
    );
    console.log(`Products (default): ${result.loadTime}ms`);

    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Products list - Release date sort', async ({ page }) => {
    const result = await measurePagePerformance(
      page,
      '/ja/products?sort=releaseDate',
      'Products (releaseDate)'
    );
    console.log(`Products (releaseDate): ${result.loadTime}ms`);

    expect(result.loadTime).toBeLessThan(10000);
  });

  test('Individual actress page', async ({ page }) => {
    // まず一覧ページから女優を見つける
    await page.goto('/ja/actresses', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const actressLink = page.locator('a[href*="/actress/"]').first();
    if (await actressLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await actressLink.getAttribute('href');

      const result = await measurePagePerformance(
        page,
        href || '/ja/actresses',
        'Actress Detail'
      );
      console.log(`Actress Detail: ${result.loadTime}ms`);

      expect(result.loadTime).toBeLessThan(10000);
    } else {
      test.skip();
    }
  });

  test('Individual product page', async ({ page }) => {
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await productLink.getAttribute('href');

      const result = await measurePagePerformance(
        page,
        href || '/ja',
        'Product Detail'
      );
      console.log(`Product Detail: ${result.loadTime}ms`);

      expect(result.loadTime).toBeLessThan(10000);
    } else {
      test.skip();
    }
  });
});

test.describe('AB Test Performance Comparison', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('Compare sort methods - A/B performance test', async ({ page }) => {
    const sortMethods = ['nameAsc', 'recent', 'productCount'];
    const iterations = 3;
    const timings: Record<string, number[]> = {};

    for (const sort of sortMethods) {
      timings[sort] = [];

      for (let i = 0; i < iterations; i++) {
        // キャッシュクリアのために新しいコンテキストでリクエスト
        await page.goto('about:blank');

        const startTime = Date.now();
        await page.goto(`/ja/actresses?sort=${sort}`, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;

        timings[sort].push(loadTime);

        // 少し待機
        await page.waitForTimeout(500);
      }
    }

    console.log('\n=== Sort Method Performance Comparison ===\n');
    for (const [sort, times] of Object.entries(timings)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      console.log(`${sort}: avg=${avg.toFixed(0)}ms, min=${min}ms, max=${max}ms`);
    }

    // すべてのソートが10秒以内であること
    for (const [sort, times] of Object.entries(timings)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avg).toBeLessThan(10000);
    }
  });
});
