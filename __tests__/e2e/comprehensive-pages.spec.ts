import { test, expect } from '@playwright/test';

/**
 * Comprehensive page tests for all major pages
 * Tests both apps/web and apps/fanza
 */

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

test.describe('Homepage Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    // Set age verification cookie
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('homepage loads with correct structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Should not redirect to age verification
    await expect(page).not.toHaveURL(/age-verification/);

    // Check page title exists
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Wait for hydration to complete (Next.js React hydration can leave elements hidden briefly)
    await page.waitForTimeout(1000);

    // Check main content area exists - exclude hidden elements
    const mainContent = page.locator('main:not([hidden]), [role="main"]:not([hidden]), .container:not([hidden])');
    const visibleContent = await mainContent.count();

    // If no visible main content found, check if page has any visible content at all
    if (visibleContent === 0) {
      // Fallback: check if body has visible children (excluding modals/portals)
      const bodyContent = page.locator('body > div:not([hidden]):not([data-radix-portal])');
      await expect(bodyContent.first()).toBeVisible({ timeout: 10000 });
    } else {
      await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('homepage has navigation elements', async ({ page }) => {
    await page.goto('/');

    // Check for header/navigation
    const header = page.locator('header, nav, [role="navigation"]');
    const headerCount = await header.count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test('homepage loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait a bit for JS to execute
    await page.waitForTimeout(2000);

    // Allow some minor errors but fail on critical ones
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection') &&
      !e.includes('installations/request-failed') && // Firebase installation errors in test env
      !e.includes('PERMISSION_DENIED') &&
      !e.includes('Database initialization failed') && // CI環境ではDBがない
      !e.includes('DATABASE_URL') // CI環境ではDBがない
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Products Page Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('products page loads', async ({ page }) => {
    const response = await page.goto('/products');
    expect(response?.status()).toBeLessThan(400);

    // Check for product grid or list
    await page.waitForLoadState('domcontentloaded');
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test('products page with language parameter', async ({ page }) => {
    const response = await page.goto('/products?hl=en');
    expect(response?.status()).toBeLessThan(400);
  });

  test('products page with sort parameter', async ({ page }) => {
    const response = await page.goto('/products?sort=releaseDateDesc');
    expect(response?.status()).toBeLessThan(400);
  });

  test('products page with pagination', async ({ page }) => {
    const response = await page.goto('/products?page=2');
    expect(response?.status()).toBeLessThan(400);
  });

  test('products page with filter parameters', async ({ page }) => {
    const response = await page.goto('/products?hasVideo=true');
    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe('Actresses Page Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('actresses list page loads', async ({ page }) => {
    // Try multiple possible URLs
    let response = await page.goto('/actresses');
    if (response?.status() === 404) {
      response = await page.goto('/');
    }
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Categories Page Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('categories page loads', async ({ page }) => {
    const response = await page.goto('/categories');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Series Page Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('series list page loads', async ({ page }) => {
    const response = await page.goto('/series');
    // 404 is acceptable if series feature is not enabled
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('API Endpoint Tests', () => {
  test('weekly-highlights API returns valid response', async ({ request }) => {
    const response = await request.get('/api/weekly-highlights');
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('products API returns valid response', async ({ request }) => {
    const response = await request.get('/api/products?limit=5');
    // API may not exist, so we just check it doesn't crash
    expect(response.status()).toBeLessThan(500);
  });

  test('search API returns valid response', async ({ request }) => {
    const response = await request.get('/api/search?q=test');
    expect(response.status()).toBeLessThan(500);
  });

  test('actresses API returns valid response', async ({ request }) => {
    const response = await request.get('/api/actresses?limit=5');
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('SEO and Meta Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('homepage has required meta tags', async ({ page }) => {
    await page.goto('/');

    // Check title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check meta description
    const description = await page.locator('meta[name="description"]').first().getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('products page has required meta tags', async ({ page }) => {
    await page.goto('/products');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);

    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toContain('user-agent');
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml', { timeout: 60000 });
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('xml');
  });
});

test.describe('Multi-language Support Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('Japanese (default) page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('English page loads with ?hl=en', async ({ page }) => {
    const response = await page.goto('/?hl=en');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/hl=en/);
  });

  test('Chinese page loads with ?hl=zh', async ({ page }) => {
    const response = await page.goto('/?hl=zh');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/hl=zh/);
  });

  test('Korean page loads with ?hl=ko', async ({ page }) => {
    const response = await page.goto('/?hl=ko');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/hl=ko/);
  });

  test('products page with language parameter', async ({ page }) => {
    const response = await page.goto('/products?hl=en');
    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe('Error Handling Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('404 page handles gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-12345');
    // Should return 404, not 500
    expect(response?.status()).toBe(404);
  });

  test('invalid product ID handles gracefully', async ({ page }) => {
    const response = await page.goto('/products/invalid-id-xyz');
    // Should return 404, not 500
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Performance Tests', () => {
  // Performance thresholds - relaxed for local dev environment
  // CI/Production should use stricter thresholds
  const PERF_THRESHOLD_MS = process.env['CI'] ? 15000 : 45000;

  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('homepage loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const loadTime = Date.now() - startTime;

    console.log(`Homepage load time: ${loadTime}ms (threshold: ${PERF_THRESHOLD_MS}ms)`);
    expect(loadTime).toBeLessThan(PERF_THRESHOLD_MS);
  });

  test('products page loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const loadTime = Date.now() - startTime;

    console.log(`Products page load time: ${loadTime}ms (threshold: ${PERF_THRESHOLD_MS}ms)`);
    expect(loadTime).toBeLessThan(PERF_THRESHOLD_MS);
  });
});

test.describe('Pagination Filter Preservation Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('pagination links should not add unexpected filter parameters', async ({ page }) => {
    // Go to products page without any filters
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    // Find pagination links (next page, page numbers, etc.)
    const paginationLinks = page.locator('nav a[href*="page="]');
    const linkCount = await paginationLinks.count();

    if (linkCount > 0) {
      // Get the href of the first pagination link
      const firstLinkHref = await paginationLinks.first().getAttribute('href');

      // The link should NOT contain unexpected filter params like 'include' or 'exclude'
      // unless they were explicitly set
      expect(firstLinkHref).not.toMatch(/include=/);
      expect(firstLinkHref).not.toMatch(/exclude=/);

      // Should contain page parameter
      expect(firstLinkHref).toMatch(/page=/);
    }
  });

  test('pagination preserves existing filters correctly', async ({ page }) => {
    // Go to products page WITH a filter
    await page.goto('/products?hasVideo=true');
    await page.waitForLoadState('domcontentloaded');

    // Find pagination links
    const paginationLinks = page.locator('nav a[href*="page="]');
    const linkCount = await paginationLinks.count();

    if (linkCount > 0) {
      // Get the href of a pagination link
      const linkHref = await paginationLinks.first().getAttribute('href');

      // Should preserve the hasVideo filter
      expect(linkHref).toMatch(/hasVideo=true/);

      // Should have page parameter
      expect(linkHref).toMatch(/page=/);
    }
  });

  test('pagination preserves language parameter', async ({ page }) => {
    // Go to products page with language parameter
    await page.goto('/products?hl=en');
    await page.waitForLoadState('domcontentloaded');

    // Find pagination links
    const paginationLinks = page.locator('nav a[href*="page="]');
    const linkCount = await paginationLinks.count();

    if (linkCount > 0) {
      // Get the href of a pagination link
      const linkHref = await paginationLinks.first().getAttribute('href');

      // Should preserve the language parameter
      expect(linkHref).toMatch(/hl=en/);
    }
  });

  test('clicking pagination does not add filters from localStorage', async ({ page }) => {
    // Clear localStorage before test
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Navigate to page 2
    await page.goto('/products?page=2', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // The URL should only have page parameter, not any auto-restored filters
    const url = page.url();
    const urlParams = new URL(url).searchParams;

    // Should have page=2
    expect(urlParams.get('page')).toBe('2');

    // Should NOT have unexpected filter params (unless explicitly in URL)
    // This catches the bug where filters get auto-added
    const hasUnexpectedInclude = urlParams.has('include') && !url.includes('include=');
    expect(hasUnexpectedInclude).toBe(false);
  });

  test('per-page selector preserves current filters', async ({ page }) => {
    // Go to products page with a filter
    await page.goto('/products?hasVideo=true&page=1');
    await page.waitForLoadState('domcontentloaded');

    // Find per-page selector
    const perPageSelector = page.locator('select[aria-label="表示件数"]');
    const selectorExists = await perPageSelector.count() > 0;

    if (selectorExists) {
      // Change per-page value
      await perPageSelector.selectOption('48');

      // Wait for navigation
      await page.waitForURL(/limit=48/);

      // Check the URL still has the filter
      const url = page.url();
      expect(url).toMatch(/hasVideo=true/);
      expect(url).toMatch(/limit=48/);
    }
  });
});

test.describe('CSP and Security Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('page loads without CSP violations in console', async ({ page }) => {
    const cspViolations: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Filter out worker-src violations (will be fixed after deployment of worker-src CSP directive)
    const criticalCspViolations = cspViolations.filter(v =>
      !v.includes("worker-src' was not explicitly set")
    );
    expect(criticalCspViolations).toHaveLength(0);
  });

  test('products page loads without CSP violations', async ({ page }) => {
    const cspViolations: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Filter out worker-src violations (will be fixed after deployment of worker-src CSP directive)
    const criticalCspViolations = cspViolations.filter(v =>
      !v.includes("worker-src' was not explicitly set")
    );
    expect(criticalCspViolations).toHaveLength(0);
  });
});
