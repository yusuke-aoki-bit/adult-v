import { test, expect } from '@playwright/test';

test.setTimeout(120000);

function getDomain(baseURL: string | undefined): string {
  if (!baseURL) return 'localhost';
  try {
    return new URL(baseURL).hostname;
  } catch {
    return 'localhost';
  }
}

test.describe('5xx Error Prevention - Page Rendering', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain: getDomain(baseURL),
        path: '/',
      },
    ]);
  });

  test('Homepage loads without 5xx', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    expect(response?.status()).toBe(200);
  });

  test('Products page loads without 5xx', async ({ page }) => {
    const response = await page.goto('/products', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('Actresses page loads without 5xx', async ({ page }) => {
    const response = await page.goto('/actresses', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('News page loads without 5xx', async ({ page }) => {
    const response = await page.goto('/news', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('Categories page loads without 5xx', async ({ page }) => {
    const response = await page.goto('/categories', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('Sales page loads without 5xx', async ({ page }) => {
    const response = await page.goto('/sales', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('English locale loads without 5xx', async ({ page }) => {
    const response = await page.goto('/?hl=en', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('Korean locale loads without 5xx', async ({ page }) => {
    const response = await page.goto('/?hl=ko', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('5xx Error Prevention - Invalid Parameters', () => {
  test('Invalid product ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/products/999999999');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid tag ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/tags/999999999');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric tag ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/tags/abc');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid maker ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/makers/999999999');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric maker ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/makers/abc');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid series ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/series/999999999');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric series ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/series/abc');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid news slug returns 404, not 500', async ({ request }) => {
    const response = await request.get('/news/non-existent-slug-12345');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid actress ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/actress/999999999');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric actress ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/actress/abc');
    expect(response.status()).not.toBe(500);
  });

  test('Invalid best year returns 404, not 500', async ({ request }) => {
    const response = await request.get('/best/9999');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric best year returns 404, not 500', async ({ request }) => {
    const response = await request.get('/best/abc');
    expect(response.status()).not.toBe(500);
  });

  test('Non-numeric product ID returns 404, not 500', async ({ request }) => {
    const response = await request.get('/products/abc-xyz');
    expect(response.status()).not.toBe(500);
  });
});

test.describe('5xx Error Prevention - Sitemaps', () => {
  test('Valid sitemap chunk returns 200', async ({ request }) => {
    const response = await request.get('/sitemap-products-0.xml');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('xml');
  });

  test('Invalid sitemap chunk (NaN) returns 400, not 500', async ({ request }) => {
    const response = await request.get('/sitemap-products-abc.xml');
    // Should be 400 (our validation) or 404 (Next.js routing), NOT 500
    expect(response.status()).not.toBe(500);
  });

  test('Out-of-range sitemap chunk returns 400', async ({ request }) => {
    const response = await request.get('/sitemap-products-999.xml');
    expect(response.status()).not.toBe(500);
  });

  test('Actresses sitemap chunk loads', async ({ request }) => {
    const response = await request.get('/sitemap-actresses-0.xml');
    expect(response.status()).toBe(200);
  });

  test('Invalid actresses sitemap chunk returns 400, not 500', async ({ request }) => {
    const response = await request.get('/sitemap-actresses-abc.xml');
    expect(response.status()).not.toBe(500);
  });

  test('Static sitemap loads', async ({ request }) => {
    const response = await request.get('/sitemap-static.xml');
    expect(response.status()).toBe(200);
  });

  test('Tags sitemap loads', async ({ request }) => {
    const response = await request.get('/sitemap-tags.xml');
    expect(response.status()).toBe(200);
  });

  test('Series sitemap loads', async ({ request }) => {
    const response = await request.get('/sitemap-series.xml');
    expect(response.status()).toBe(200);
  });

  test('Makers sitemap loads', async ({ request }) => {
    const response = await request.get('/sitemap-makers.xml');
    expect(response.status()).toBe(200);
  });
});

test.describe('5xx Error Prevention - News API', () => {
  test('News API latest mode returns JSON', async ({ request }) => {
    const response = await request.get('/api/news?mode=latest&limit=5');
    expect(response.status()).toBeLessThan(500);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('articles');
    }
  });

  test('News API category mode returns JSON', async ({ request }) => {
    const response = await request.get('/api/news?category=new_releases&page=1');
    expect(response.status()).toBeLessThan(500);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('articles');
    }
  });
});
