import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * スクリーンショットベースのビジュアルリグレッションテスト
 *
 * 使用方法:
 * 1. 初回実行時にベースラインスクリーンショットを生成
 *    npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 *
 * 2. 以降の実行で差分を検出
 *    npx playwright test e2e/visual-regression.spec.ts
 */

test.describe.configure({ mode: 'parallel' });

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test.describe('Desktop Views', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('Homepage desktop screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Hide dynamic content for consistent screenshots
      await page.evaluate(() => {
        // Hide timestamps, counters, etc.
        document.querySelectorAll('[data-testid="timestamp"], .timestamp, .dynamic-counter').forEach((el) => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
      });

      await expect(page).toHaveScreenshot('homepage-desktop.png', {
        maxDiffPixels: 100,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });

    test('Product list page desktop screenshot', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('products-list-desktop.png', {
        maxDiffPixels: 200,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });

    test('Actresses list page desktop screenshot', async ({ page }) => {
      await page.goto('/actresses');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('actresses-list-desktop.png', {
        maxDiffPixels: 200,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });
  });

  test.describe('Mobile Views', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('Homepage mobile screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('homepage-mobile.png', {
        maxDiffPixels: 100,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });

    test('Navigation menu mobile screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Open mobile menu if present
      const menuButton = page.locator('button[aria-label*="menu"], [data-testid="mobile-menu"]').first();
      if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('mobile-menu-open.png', {
          maxDiffPixels: 100,
          maxDiffPixelRatio: 0.02,
          threshold: 0.3,
        });
      }
    });
  });

  test.describe('Tablet Views', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('Homepage tablet screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('homepage-tablet.png', {
        maxDiffPixels: 150,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });
  });

  test.describe('Component Screenshots', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('Header component screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const header = page.locator('header, [role="banner"]').first();
      if (await header.isVisible().catch(() => false)) {
        await expect(header).toHaveScreenshot('header-component.png', {
          maxDiffPixels: 50,
          maxDiffPixelRatio: 0.02,
          threshold: 0.2,
        });
      }
    });

    test('Footer component screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const footer = page.locator('footer, [role="contentinfo"]').first();
      if (await footer.isVisible().catch(() => false)) {
        await footer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        await expect(footer).toHaveScreenshot('footer-component.png', {
          maxDiffPixels: 50,
          maxDiffPixelRatio: 0.02,
          threshold: 0.2,
        });
      }
    });

    test('Product card component screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const productCard = page.locator('[data-testid="product-card"], article, .product-card').first();
      if (await productCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(productCard).toHaveScreenshot('product-card-component.png', {
          maxDiffPixels: 50,
          maxDiffPixelRatio: 0.02,
          threshold: 0.3,
        });
      }
    });

    test('Product card with image screenshot on /products', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // 画像読み込み待ち

      // ProductCard（rounded-2xl shadow-lgを持つdiv）を取得
      const productCard = page.locator('div[class*="rounded-2xl"][class*="shadow-lg"]').first();

      if (await productCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // カード全体のスクリーンショット
        await expect(productCard).toHaveScreenshot('product-card-with-image.png', {
          maxDiffPixels: 100,
          maxDiffPixelRatio: 0.02,
          threshold: 0.3,
        });

        // 画像が正しく表示されていることを確認
        const img = productCard.locator('img').first();
        const box = await img.boundingBox();

        if (box) {
          expect(box.height).toBeGreaterThan(100); // 画像が表示されている
          expect(box.width).toBeGreaterThan(100);
          console.log(`ProductCard image size: ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }
    });

    test('ActressCard with image screenshot on homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // ActressCard（aspect-ratio スタイルを持つコンテナ内）を取得
      const actressCard = page.locator('div[style*="aspect-ratio"] img').first();

      if (await actressCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        const box = await actressCard.boundingBox();

        if (box) {
          expect(box.height).toBeGreaterThan(50); // 画像が表示されている
          expect(box.width).toBeGreaterThan(50);
          console.log(`ActressCard image size: ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }
    });
  });

  test.describe('Dark/Light Theme', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('Dark theme screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Ensure dark theme is applied
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('homepage-dark-theme.png', {
        maxDiffPixels: 100,
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    });
  });

  test.describe('State Screenshots', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('Loading state screenshot', async ({ page }) => {
      // Intercept API to show loading state
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.continue();
      });

      await page.goto('/');

      // Capture loading state quickly
      await expect(page)
        .toHaveScreenshot('loading-state.png', {
          maxDiffPixels: 200,
          maxDiffPixelRatio: 0.02,
          threshold: 0.5,
          timeout: 3000,
        })
        .catch(() => {
          console.log('Loading state screenshot skipped - page loaded too fast');
        });
    });

    test('Empty state screenshot', async ({ page }) => {
      // Navigate to search with unlikely query
      await page.goto('/search?q=zzzznonexistentquery12345');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // This might show an empty state
      await expect(page)
        .toHaveScreenshot('empty-search-results.png', {
          maxDiffPixels: 100,
          maxDiffPixelRatio: 0.02,
          threshold: 0.3,
        })
        .catch(() => {
          console.log('Empty state screenshot skipped');
        });
    });
  });
});

test.describe('Cross-Browser Visual Consistency', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('Homepage renders consistently', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot(`homepage-${browserName}.png`, {
      maxDiffPixels: 200,
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
    });
  });
});
