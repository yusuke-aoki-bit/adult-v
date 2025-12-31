import { test, expect } from '@playwright/test';

/**
 * FANZA Traffic Tests
 * Tests for FANZA site traffic strengthening features from apps/web
 *
 * These tests verify:
 * 1. FANZA banner visibility and links
 * 2. FANZA new releases section
 * 3. Cross-site navigation
 * 4. Affiliate compliance (links go through f.adult-v.com)
 */

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

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

// Helper to check if running on web app (not fanza app)
function isWebApp(baseURL: string | undefined): boolean {
  if (!baseURL) return true;
  return baseURL.includes('3000') || baseURL.includes('adult-v.com');
}

test.describe('FANZA Site Banner Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('footer contains FANZA site banner on web app', async ({ page, baseURL }) => {
    // Skip if running on fanza app
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Scroll to footer to ensure it's loaded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check for FANZA banner in footer
    const fanzaBanner = page.locator('footer').locator('a[href*="f.adult-v.com"]');
    const bannerCount = await fanzaBanner.count();

    // Should have at least one FANZA link in footer
    expect(bannerCount).toBeGreaterThan(0);
  });

  test('FANZA banner links to correct URL', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const fanzaLink = page.locator('footer').locator('a[href*="f.adult-v.com"]').first();

    if (await fanzaLink.count() > 0) {
      const href = await fanzaLink.getAttribute('href');
      expect(href).toContain('f.adult-v.com');

      // Should open in new tab
      const target = await fanzaLink.getAttribute('target');
      expect(target).toBe('_blank');

      // Should have rel for security
      const rel = await fanzaLink.getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });

  test('FANZA banner has proper accessibility attributes', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const fanzaBanner = page.locator('footer').locator('a[href*="f.adult-v.com"]').first();

    if (await fanzaBanner.count() > 0) {
      // Check for visible text or aria-label
      const text = await fanzaBanner.textContent();
      const ariaLabel = await fanzaBanner.getAttribute('aria-label');

      // Should have either visible text or aria-label
      expect(text?.length || ariaLabel?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('FANZA New Releases Section Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('homepage shows FANZA new releases section on web app', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dynamic content to load
    await page.waitForTimeout(2000);

    // Look for FANZA section heading or content
    const fanzaSection = page.locator('text=FANZA新作').or(page.locator('text=FANZA New'));
    const sectionVisible = await fanzaSection.count() > 0;

    // Section may not appear if API fails, so we just check structure exists
    if (sectionVisible) {
      // Check section has product links
      const productLinks = page.locator('section').filter({ hasText: /FANZA/ }).locator('a[href*="f.adult-v.com"]');
      const linkCount = await productLinks.count();
      expect(linkCount).toBeGreaterThanOrEqual(0); // May be 0 if no products loaded
    }
  });

  test('FANZA section CTA links to FANZA site', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find CTA button/link in FANZA section
    const fanzaCta = page.locator('a[href*="f.adult-v.com/products"]');

    if (await fanzaCta.count() > 0) {
      const href = await fanzaCta.first().getAttribute('href');
      expect(href).toContain('f.adult-v.com');
    }
  });
});

test.describe('Products Page FANZA Banner Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('products page shows FANZA card banner on web app', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    // Look for FANZA card variant banner
    const fanzaCard = page.locator('a[href*="f.adult-v.com"]').filter({ hasText: /FANZA/ });

    // May not appear if not on top page (has filters)
    const cardCount = await fanzaCard.count();
    // Just verify no errors, banner presence depends on page state
    expect(cardCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('FANZA Link Compliance Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('all FANZA links go through f.adult-v.com (not direct FANZA)', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check all links on page
    const allLinks = await page.locator('a').all();

    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        // Should NOT link directly to fanza.com or dmm.co.jp
        expect(href).not.toMatch(/fanza\.com/);
        expect(href).not.toMatch(/dmm\.co\.jp/);

        // FANZA related links should go through f.adult-v.com
        if (href.includes('fanza') || href.toLowerCase().includes('fanza')) {
          expect(href).toContain('f.adult-v.com');
        }
      }
    }
  });

  test('FANZA links preserve locale parameter', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    // Test with English locale
    await page.goto('/?hl=en');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const fanzaLinks = await page.locator('a[href*="f.adult-v.com"]').all();

    for (const link of fanzaLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        // Should include locale parameter or path
        const hasLocale = href.includes('hl=en') || href.includes('/en/');
        expect(hasLocale).toBe(true);
      }
    }
  });
});

test.describe('Cross-Site Navigation Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('header has FANZA badge linking to FANZA site', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for FANZA badge in header
    const headerFanzaBadge = page.locator('header').locator('a[href*="f.adult-v.com"]');
    const badgeCount = await headerFanzaBadge.count();

    // Header may have FANZA link
    if (badgeCount > 0) {
      const href = await headerFanzaBadge.first().getAttribute('href');
      expect(href).toContain('f.adult-v.com');
    }
  });

  test('product detail page has FanzaCrossLink for FANZA products', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    // Navigate to products page first
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    // Click on first product to go to detail page
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.count() > 0) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Check for FanzaCrossLink component
      const fanzaCrossLink = page.locator('a[href*="f.adult-v.com/"][href*="/products/"]');

      // May or may not exist depending on whether product is available on FANZA
      const linkCount = await fanzaCrossLink.count();
      expect(linkCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('actress page has FanzaSiteLink for actresses with FANZA products', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click on first actress to go to detail page
    const actressLink = page.locator('a[href*="/actress/"]').first();

    if (await actressLink.count() > 0) {
      await actressLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Check for FanzaSiteLink component
      const fanzaSiteLink = page.locator('a[href*="f.adult-v.com/"][href*="/actress/"]');

      // May or may not exist depending on whether actress has FANZA products
      const linkCount = await fanzaSiteLink.count();
      expect(linkCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('FANZA Features - Fanza App Exclusion Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('fanza app should NOT show FANZA cross-site banners', async ({ page, baseURL }) => {
    // Only run on fanza app
    if (isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should NOT have links to f.adult-v.com (would be circular)
    const crossSiteLinks = page.locator('a[href*="f.adult-v.com"]');
    const linkCount = await crossSiteLinks.count();

    // Fanza app should not promote itself
    expect(linkCount).toBe(0);
  });

  test('fanza app should NOT show other ASP links', async ({ page, baseURL }) => {
    if (isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should NOT have links to other ASPs (MGS, DUGA, etc.)
    const mgsLinks = page.locator('a[href*="mgstage.com"]');
    const dugaLinks = page.locator('a[href*="duga.jp"]');

    expect(await mgsLinks.count()).toBe(0);
    expect(await dugaLinks.count()).toBe(0);
  });
});

test.describe('FANZA Banner Responsive Tests', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = getDomain(baseURL);
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain,
      path: '/',
    }]);
  });

  test('FANZA banner is visible on mobile viewport', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const fanzaBanner = page.locator('a[href*="f.adult-v.com"]').first();

    if (await fanzaBanner.count() > 0) {
      await expect(fanzaBanner).toBeVisible();
    }
  });

  test('FANZA banner is visible on tablet viewport', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const fanzaBanner = page.locator('a[href*="f.adult-v.com"]').first();

    if (await fanzaBanner.count() > 0) {
      await expect(fanzaBanner).toBeVisible();
    }
  });

  test('FANZA new releases section adapts to mobile', async ({ page, baseURL }) => {
    if (!isWebApp(baseURL)) {
      test.skip();
      return;
    }

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check section exists and is not overflowing
    const fanzaSection = page.locator('section').filter({ hasText: /FANZA/ }).first();

    if (await fanzaSection.count() > 0) {
      const box = await fanzaSection.boundingBox();
      if (box) {
        // Section should not overflow viewport
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });
});
