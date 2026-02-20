import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// Target URL: use env var or fallback to production
// In CI, skip this entire file unless E2E_BASE_URL is explicitly set
const BASE = process.env['E2E_BASE_URL'] || 'https://www.adult-v.com';
const SKIP_IN_CI = !!process.env['CI'] && !process.env['E2E_BASE_URL'];

// Skip all tests in CI without explicit E2E_BASE_URL
test.beforeEach(async ({}, testInfo) => {
  if (SKIP_IN_CI) testInfo.skip(true, 'Skipped in CI without E2E_BASE_URL');
});

function url(path: string): string {
  return `${BASE}${path}`;
}

test.describe('Production E2E - Page Status Codes', () => {
  const pages = [
    { name: 'Homepage', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Actresses', path: '/actresses' },
    { name: 'Sales', path: '/sales' },
    { name: 'Discover', path: '/discover' },
    { name: 'Makers', path: '/makers' },
    { name: 'Weekly Report', path: '/weekly-report' },
    { name: 'Birthdays', path: '/birthdays' },
    { name: 'Daily Pick', path: '/daily-pick' },
    { name: 'Rankings', path: '/lists/ranking' },
    { name: 'Best 2025', path: '/best/2025' },
    { name: 'Search Image', path: '/search/image' },
    { name: 'Search Semantic', path: '/search/semantic' },
    { name: 'Compare', path: '/compare' },
    { name: 'Compare Performers', path: '/compare/performers' },
    { name: 'Settings', path: '/settings' },
    { name: 'Favorites', path: '/favorites' },
    { name: 'Watchlist', path: '/watchlist' },
    { name: 'Budget', path: '/budget' },
    { name: 'Diary', path: '/diary' },
    { name: 'Alerts', path: '/alerts' },
    { name: 'Profile', path: '/profile' },
  ];

  for (const p of pages) {
    test(`${p.name} (${p.path}) - no 5xx`, async ({ request }) => {
      const response = await request.get(url(p.path), {
        headers: { 'Cookie': 'age-verified=true' },
        maxRedirects: 5,
      });
      const status = response.status();
      expect(status, `${p.name} returned ${status}`).toBeLessThan(500);
    });
  }
});

test.describe('Production E2E - Locale Pages', () => {
  const locales = ['ja', 'en', 'ko', 'zh', 'zh-TW'];
  for (const locale of locales) {
    test(`Homepage /${locale} - no 5xx`, async ({ request }) => {
      const response = await request.get(url(`/${locale}`), {
        headers: { 'Cookie': 'age-verified=true' },
        maxRedirects: 5,
      });
      expect(response.status()).toBeLessThan(500);
    });
  }
});

test.describe('Production E2E - API Routes', () => {
  const apis = [
    { name: 'Trends', path: '/api/trends' },
    { name: 'Products Search', path: '/api/products/search?q=test&limit=5' },
    { name: 'Ranking Products', path: '/api/ranking/products?limit=5' },
    { name: 'Ranking Actresses', path: '/api/ranking/actresses?limit=5' },
    { name: 'Ranking Rookies', path: '/api/ranking/rookies?limit=5' },
    { name: 'Recommendations', path: '/api/recommendations?limit=5' },
    { name: 'News', path: '/api/news?mode=latest&limit=5' },
    { name: 'Stats ASP', path: '/api/stats/asp' },
    { name: 'Weekly Highlights', path: '/api/weekly-highlights' },
    { name: 'Sale Calendar', path: '/api/sale-calendar' },
    { name: 'Sales For You', path: '/api/sales/for-you' },
    { name: 'Autocomplete', path: '/api/search/autocomplete?q=test' },
  ];

  for (const api of apis) {
    test(`API ${api.name} (${api.path}) - no 5xx`, async ({ request }) => {
      const response = await request.get(url(api.path), { maxRedirects: 5 });
      const status = response.status();
      expect(status, `API ${api.name} returned ${status}`).toBeLessThan(500);
    });
  }
});

test.describe('Production E2E - Dynamic Pages', () => {
  test('Product detail page - no 5xx', async ({ request }) => {
    // First get a real product ID from the API
    const searchResp = await request.get(url('/api/ranking/products?limit=1'));
    if (searchResp.ok()) {
      const data = await searchResp.json();
      const products = data.products || data.data || data.items || [];
      if (products.length > 0) {
        const productId = products[0].id || products[0].product_id;
        if (productId) {
          const response = await request.get(url(`/products/${productId}`), {
            headers: { 'Cookie': 'age-verified=true' },
            maxRedirects: 5,
          });
          expect(response.status()).toBeLessThan(500);
        }
      }
    }
  });

  test('Actress detail page - no 5xx', async ({ request }) => {
    const searchResp = await request.get(url('/api/ranking/actresses?limit=1'));
    if (searchResp.ok()) {
      const data = await searchResp.json();
      const actresses = data.performers || data.actresses || data.data || [];
      if (actresses.length > 0) {
        const actressId = actresses[0].id || actresses[0].performer_id;
        if (actressId) {
          const response = await request.get(url(`/actress/${actressId}`), {
            headers: { 'Cookie': 'age-verified=true' },
            maxRedirects: 5,
          });
          expect(response.status()).toBeLessThan(500);
        }
      }
    }
  });

  test('Invalid product ID returns 404, not 500', async ({ request }) => {
    const response = await request.get(url('/products/999999999'), {
      headers: { 'Cookie': 'age-verified=true' },
      maxRedirects: 5,
    });
    expect(response.status()).not.toBe(500);
  });

  test('Invalid actress ID returns 404, not 500', async ({ request }) => {
    const response = await request.get(url('/actress/999999999'), {
      headers: { 'Cookie': 'age-verified=true' },
      maxRedirects: 5,
    });
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric product ID returns 404, not 500', async ({ request }) => {
    const response = await request.get(url('/products/abc-xyz'), {
      headers: { 'Cookie': 'age-verified=true' },
      maxRedirects: 5,
    });
    expect(response.status()).not.toBe(500);
  });

  test('Invalid maker ID returns 404, not 500', async ({ request }) => {
    const response = await request.get(url('/makers/999999999'), {
      headers: { 'Cookie': 'age-verified=true' },
      maxRedirects: 5,
    });
    expect(response.status()).not.toBe(500);
  });
});

test.describe('Production E2E - Sitemaps & SEO', () => {
  const sitemaps = [
    '/sitemap.xml',
    '/sitemap-static.xml',
    '/sitemap-products-1.xml',
    '/sitemap-products-2.xml',
    '/sitemap-actresses.xml',
    '/sitemap-makers.xml',
    '/sitemap-series.xml',
    '/sitemap-tags.xml',
    '/sitemap-videos.xml',
    '/robots.txt',
    '/feed.xml',
  ];

  for (const path of sitemaps) {
    test(`${path} - returns 200`, async ({ request }) => {
      const response = await request.get(url(path), { maxRedirects: 5 });
      const status = response.status();
      expect(status, `${path} returned ${status}`).toBe(200);
    });
  }
});

test.describe('Production E2E - Console Errors Check', () => {
  test('Homepage renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      // Ignore known benign errors
      if (err.message.includes('ResizeObserver') ||
          err.message.includes('Loading chunk') ||
          err.message.includes('Firebase') ||
          err.message.includes('gtag')) return;
      errors.push(err.message);
    });

    await page.context().addCookies([{
      name: 'age-verified', value: 'true',
      domain: new URL(BASE).hostname, path: '/',
    }]);

    const response = await page.goto(url('/'), { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);

    // Wait for client-side hydration
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log('JS Errors found:', errors);
    }
    expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('Products page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('ResizeObserver') ||
          err.message.includes('Loading chunk') ||
          err.message.includes('Firebase') ||
          err.message.includes('gtag')) return;
      errors.push(err.message);
    });

    await page.context().addCookies([{
      name: 'age-verified', value: 'true',
      domain: new URL(BASE).hostname, path: '/',
    }]);

    const response = await page.goto(url('/products'), { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);

    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log('JS Errors found:', errors);
    }
    expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  });
});

test.describe('Production E2E - Failed Network Requests', () => {
  test('Homepage has no 5xx API calls', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.context().addCookies([{
      name: 'age-verified', value: 'true',
      domain: new URL(BASE).hostname, path: '/',
    }]);

    await page.goto(url('/'), { waitUntil: 'domcontentloaded' });

    if (failedRequests.length > 0) {
      console.log('5xx responses:', failedRequests);
    }
    expect(failedRequests, `5xx requests: ${JSON.stringify(failedRequests)}`).toHaveLength(0);
  });

  test('Products page has no 5xx API calls', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.context().addCookies([{
      name: 'age-verified', value: 'true',
      domain: new URL(BASE).hostname, path: '/',
    }]);

    await page.goto(url('/products'), { waitUntil: 'domcontentloaded' });

    if (failedRequests.length > 0) {
      console.log('5xx responses:', failedRequests);
    }
    expect(failedRequests, `5xx requests: ${JSON.stringify(failedRequests)}`).toHaveLength(0);
  });

  test('Actresses page has no 5xx API calls', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.context().addCookies([{
      name: 'age-verified', value: 'true',
      domain: new URL(BASE).hostname, path: '/',
    }]);

    await page.goto(url('/actresses'), { waitUntil: 'domcontentloaded' });

    if (failedRequests.length > 0) {
      console.log('5xx responses:', failedRequests);
    }
    expect(failedRequests, `5xx requests: ${JSON.stringify(failedRequests)}`).toHaveLength(0);
  });
});
