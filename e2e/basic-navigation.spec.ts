import { test, expect } from '@playwright/test';

test.describe('Basic Navigation & SEO', () => {
  test('should load homepage with age verification', async ({ page }) => {
    await page.goto('/ja');

    // Should show age verification page
    await expect(page).toHaveURL(/age-verification/);
    await expect(page.locator('button:has-text("18歳以上")')).toBeVisible();
  });

  test('should accept age verification and navigate to homepage', async ({ page }) => {
    await page.goto('/ja');

    // Click age verification button
    await page.click('button:has-text("入場"), button:has-text("はい"), button:has-text("18")');

    // Should redirect to homepage
    await expect(page).toHaveURL(/\/ja\/?$/);
    await expect(page).toHaveTitle(/Adult Viewer Lab/i);
  });

  test('should have proper meta tags for SEO', async ({ page, context }) => {
    // Set age verification cookie to bypass age gate
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'adult-v--adult-v.asia-east1.hosted.app',
      path: '/',
    }]);

    await page.goto('/ja');

    // Check basic meta tags
    const title = await page.title();
    expect(title).toContain('Adult Viewer Lab');

    // Check meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();

    // Check og:image
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();
  });

  test('should have hreflang tags for multi-language support', async ({ page, context }) => {
    // Set age verification cookie
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'adult-v--adult-v.asia-east1.hosted.app',
      path: '/',
    }]);

    await page.goto('/ja');

    // Check for hreflang tags
    const hreflangLinks = await page.locator('link[rel="alternate"][hreflang]').count();
    expect(hreflangLinks).toBeGreaterThan(0);

    // Check specific languages
    const jaLink = await page.locator('link[rel="alternate"][hreflang="ja"]').getAttribute('href');
    const enLink = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href');
    const zhLink = await page.locator('link[rel="alternate"][hreflang="zh"]').getAttribute('href');
    const koLink = await page.locator('link[rel="alternate"][hreflang="ko"]').getAttribute('href');

    expect(jaLink).toContain('/ja');
    expect(enLink).toContain('/en');
    expect(zhLink).toContain('/zh');
    expect(koLink).toContain('/ko');
  });

  test('should navigate between language versions', async ({ page, context }) => {
    // Set age verification cookie
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'adult-v--adult-v.asia-east1.hosted.app',
      path: '/',
    }]);

    // Test Japanese
    await page.goto('/ja');
    await expect(page).toHaveURL(/\/ja/);

    // Test English
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en/);

    // Test Chinese
    await page.goto('/zh');
    await expect(page).toHaveURL(/\/zh/);

    // Test Korean
    await page.goto('/ko');
    await expect(page).toHaveURL(/\/ko/);
  });

  test('should load robots.txt', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);

    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toContain('user-agent');
    expect(content).toContain('Sitemap');
  });

  test('should load sitemap.xml', async ({ page }) => {
    const response = await page.goto('/sitemap.xml', { timeout: 60000 });
    expect(response?.status()).toBe(200);

    // Check content type instead of parsing large XML
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('xml');
  });
});

test.describe('PageSpeed Insights Bot Detection', () => {
  // These tests will pass after middleware.ts changes are deployed
  test.skip('should allow Googlebot without age verification', async ({ page, context }) => {
    // Set Googlebot user agent
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });

    await page.goto('/ja');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
    await expect(page).toHaveURL(/\/ja\/?$/);
  });

  test.skip('should allow Lighthouse without age verification', async ({ page, context }) => {
    // Set Lighthouse user agent
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Chrome-Lighthouse',
    });

    await page.goto('/ja');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
    await expect(page).toHaveURL(/\/ja\/?$/);
  });

  test('should allow PageSpeed Insights with x-purpose header', async ({ page, context }) => {
    // Set PageSpeed Insights headers
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/116.0.0.0 Safari/537.36',
      'X-Purpose': 'preview',
    });

    await page.goto('/ja');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
    await expect(page).toHaveURL(/\/ja\/?$/);
  });
});
