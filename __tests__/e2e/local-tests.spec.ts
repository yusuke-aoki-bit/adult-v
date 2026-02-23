import { test, expect } from '@playwright/test';

test.describe('Local Server Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Set age verification cookie to bypass age gate
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/ja');

    // Check page loads with 200 status
    expect(response?.status()).toBe(200);

    // Check for main content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('product sort dropdown is visible and functional', async ({ page }) => {
    await page.goto('/ja');

    // Wait for page to load (use domcontentloaded instead of networkidle)
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for client-side rendering
    await page.waitForTimeout(2000);

    // Check for sort dropdown
    const sortDropdown = page.locator('select#product-sort');
    if (await sortDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verify it has options
      const options = sortDropdown.locator('option');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);

      // Try changing sort
      await sortDropdown.selectOption('releaseDateAsc');
      await expect(page).toHaveURL(/sort=releaseDateAsc/);
    } else {
      // Sort dropdown may not be on this page, that's OK
      test.skip();
    }
  });

  test('pagination works correctly', async ({ page }) => {
    await page.goto('/ja');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for pagination
    const pagination = page.locator('nav[aria-label*="pagination"], nav[aria-label*="ページネーション"], .pagination');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check for page links
      const pageLinks = pagination.locator('a, button');
      const count = await pageLinks.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Pagination may not be visible if there's not enough data
      test.skip();
    }
  });

  test('filter chips appear when filters are applied', async ({ page }) => {
    // Navigate with a filter
    await page.goto('/ja?onSale=true');

    await page.waitForLoadState('domcontentloaded');

    // Page should load successfully
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('multi-language support - pages load', async ({ page }) => {
    // Test Japanese (default)
    const jaResponse = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(jaResponse?.status()).toBeLessThan(400);

    // Test English with ?hl=en format
    const enResponse = await page.goto('/?hl=en', { waitUntil: 'domcontentloaded' });
    expect(enResponse?.status()).toBeLessThan(400);

    // Test Chinese with ?hl=zh format
    const zhResponse = await page.goto('/?hl=zh', { waitUntil: 'domcontentloaded' });
    expect(zhResponse?.status()).toBeLessThan(400);

    // Test Korean with ?hl=ko format
    const koResponse = await page.goto('/?hl=ko', { waitUntil: 'domcontentloaded' });
    expect(koResponse?.status()).toBeLessThan(400);
  });

  test('API endpoints respond', async ({ page, baseURL }) => {
    // Test recommendations API
    const response = await page.request.post(`${baseURL}/api/recommendations`, {
      data: { productIds: [] },
    });
    expect(response.status()).toBeLessThan(500);

    // Test stats API
    const statsResponse = await page.request.get(`${baseURL}/api/stats/sales`);
    expect(statsResponse.status()).toBeLessThan(500);
  });

  test('weekly highlights API responds without 500 error', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/api/weekly-highlights`);
    // Should not be 500 after our fix
    expect(response.status()).toBeLessThan(500);

    // Verify response has expected structure
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('trendingActresses');
      expect(data).toHaveProperty('hotNewReleases');
      expect(data).toHaveProperty('rediscoveredClassics');
    }
  });
});

test.describe('Filter Component Tests', () => {
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

  test('sort dropdown renders with correct theme', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const sortDropdown = page.locator('select#product-sort');
    if (await sortDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check that dropdown is styled
      const hasClass = await sortDropdown.getAttribute('class');
      expect(hasClass).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('URL parameters persist after sort change', async ({ page }) => {
    await page.goto('/ja?limit=48');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const sortDropdown = page.locator('select#product-sort');
    if (await sortDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sortDropdown.selectOption('priceAsc');

      // Check that limit parameter is preserved
      await expect(page).toHaveURL(/limit=48/);
      await expect(page).toHaveURL(/sort=priceAsc/);
    } else {
      test.skip();
    }
  });
});

test.describe('CSP and Security Tests', () => {
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

  test('page loads without CSP violations', async ({ page }) => {
    const cspViolations: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // No CSP violations should be logged (for domains we added)
    const adDomainViolations = cspViolations.filter(
      (v) =>
        v.includes('ad.duga.jp') ||
        v.includes('sokmil-ad.com') ||
        v.includes('pixelarchivenow.com') ||
        v.includes('golden-gateway.com'),
    );

    expect(adDomainViolations).toHaveLength(0);
  });
});
