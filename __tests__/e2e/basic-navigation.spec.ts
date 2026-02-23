import { test, expect } from '@playwright/test';

// Increase timeout for all tests in this file (dev environment is slower)
test.setTimeout(120000);

// Helper to get domain from baseURL
function getDomain(baseURL: string | undefined): string {
  if (!baseURL) return 'localhost';
  try {
    const url = new URL(baseURL);
    return url.hostname;
  } catch {
    return 'localhost';
  }
}

test.describe('Basic Navigation & SEO', () => {
  test('should load homepage with age verification', async ({ page }) => {
    await page.goto('/');

    // Should show age verification page OR homepage (depending on cookie)
    // Note: Local dev may bypass age verification
    const url = page.url();
    expect(url.includes('age-verification') || url.endsWith('/') || url.includes('localhost')).toBeTruthy();
  });

  test('should accept age verification and navigate to homepage', async ({ page, context, baseURL }) => {
    // First, set age verification cookie to bypass age gate
    const domain = getDomain(baseURL);
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain,
        path: '/',
      },
    ]);

    await page.goto('/');

    // Should be on homepage (not age verification)
    await expect(page).not.toHaveURL(/age-verification/);
  });

  test('should have proper meta tags for SEO', async ({ page, context, baseURL }) => {
    // Set age verification cookie to bypass age gate
    const domain = getDomain(baseURL);
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain,
        path: '/',
      },
    ]);

    await page.goto('/');

    // Check basic meta tags - title varies between apps
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check meta description (may have multiple, use first)
    const description = await page.locator('meta[name="description"]').first().getAttribute('content');
    expect(description).toBeTruthy();

    // Check og:image (may have multiple, use first)
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(ogImage).toBeTruthy();
  });

  test('should have hreflang tags for multi-language support', async ({ page, context, baseURL }) => {
    // Set age verification cookie
    const domain = getDomain(baseURL);
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain,
        path: '/',
      },
    ]);

    await page.goto('/');

    // Check for hreflang tags
    const hreflangLinks = await page.locator('link[rel="alternate"][hreflang]').count();
    expect(hreflangLinks).toBeGreaterThan(0);

    // Check specific languages - can be either ?hl= format or /locale/ format
    const jaLink = await page.locator('link[rel="alternate"][hreflang="ja"]').getAttribute('href');
    const enLink = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href');
    const zhLink = await page.locator('link[rel="alternate"][hreflang="zh"]').getAttribute('href');
    const koLink = await page.locator('link[rel="alternate"][hreflang="ko"]').getAttribute('href');

    // Check that links exist and contain language indicator (either /xx or ?hl=xx)
    expect(jaLink).toBeTruthy();
    expect(enLink).toMatch(/\/en|hl=en/);
    expect(zhLink).toMatch(/\/zh|hl=zh/);
    expect(koLink).toMatch(/\/ko|hl=ko/);
  });

  test('should navigate between language versions', async ({ page, context, baseURL }) => {
    // Set age verification cookie
    const domain = getDomain(baseURL);
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain,
        path: '/',
      },
    ]);

    // Test default Japanese - use waitUntil: 'domcontentloaded' for faster navigation
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page).not.toHaveURL(/age-verification/);

    // Test English with ?hl=en
    await page.goto('/?hl=en', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page).toHaveURL(/hl=en/);

    // Test Chinese with ?hl=zh
    await page.goto('/?hl=zh', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page).toHaveURL(/hl=zh/);

    // Test Korean with ?hl=ko
    await page.goto('/?hl=ko', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page).toHaveURL(/hl=ko/);
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

    await page.goto('/');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
  });

  test.skip('should allow Lighthouse without age verification', async ({ page, context }) => {
    // Set Lighthouse user agent
    await context.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Chrome-Lighthouse',
    });

    await page.goto('/');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
  });

  test('should allow PageSpeed Insights with x-purpose header', async ({ page, context }) => {
    // Set PageSpeed Insights headers
    await context.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/116.0.0.0 Safari/537.36',
      'X-Purpose': 'preview',
    });

    await page.goto('/');

    // Should NOT redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);
  });
});
