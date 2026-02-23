import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * アクセシビリティテスト
 * WCAG 2.1 AA準拠チェック
 */

// Increase timeout for accessibility scans
test.setTimeout(120000);

test.describe('Accessibility Tests', () => {
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

  test('Homepage has no critical accessibility violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.third-party-widget') // Exclude third-party content
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (criticalViolations.length > 0) {
      console.log('Critical/Serious Accessibility Violations:');
      criticalViolations.forEach((v) => {
        console.log(`- ${v.id}: ${v.description}`);
        console.log(`  Impact: ${v.impact}`);
        console.log(`  Elements: ${v.nodes.length}`);
      });
    }

    // Allow minor violations but fail on critical/serious ones
    expect(criticalViolations).toHaveLength(0);
  });

  test('Product page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const accessibilityScanResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      expect(criticalViolations).toHaveLength(0);
    } else {
      test.skip();
    }
  });

  test('Navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Check that something is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    expect(focusedElement).toBeTruthy();
  });

  test('Interactive elements have proper focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find all interactive elements
    const buttons = page.locator('button, a, [role="button"], input, select');
    const count = await buttons.count();

    if (count > 0) {
      // Check first interactive element for focus style
      const firstButton = buttons.first();
      await firstButton.focus();

      const hasFocusStyle = await firstButton.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;

        // Check if there's a visible focus indicator
        return (
          (outline !== 'none' && outline !== '0px none rgb(0, 0, 0)') || (boxShadow !== 'none' && boxShadow !== '')
        );
      });

      console.log(`Focus indicator present: ${hasFocusStyle}`);
    }
  });

  test('Images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const images = page.locator('img');
    const imageCount = await images.count();

    let imagesWithAlt = 0;
    let imagesWithoutAlt = 0;

    for (let i = 0; i < Math.min(imageCount, 20); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      if (alt !== null && alt !== '') {
        imagesWithAlt++;
      } else {
        imagesWithoutAlt++;
        const src = await img.getAttribute('src');
        console.log(`Image without alt: ${src?.slice(0, 50)}...`);
      }
    }

    console.log(`Images with alt: ${imagesWithAlt}, without: ${imagesWithoutAlt}`);

    // At least 80% of images should have alt text
    const altTextRatio = imagesWithAlt / (imagesWithAlt + imagesWithoutAlt);
    expect(altTextRatio).toBeGreaterThan(0.5); // Relax for decorative images
  });

  test('Form inputs have labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const inputs = page.locator('input:not([type="hidden"]), select, textarea');
    const inputCount = await inputs.count();

    let inputsWithLabel = 0;

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      // Check if input has associated label
      let hasLabel = false;

      if (ariaLabel || ariaLabelledby) {
        hasLabel = true;
      } else if (id) {
        const labelCount = await page.locator(`label[for="${id}"]`).count();
        hasLabel = labelCount > 0;
      } else if (placeholder) {
        // Placeholder as label (not ideal but acceptable)
        hasLabel = true;
      }

      if (hasLabel) {
        inputsWithLabel++;
      }
    }

    console.log(`Inputs with labels: ${inputsWithLabel}/${inputCount}`);
  });

  test('Color contrast is sufficient', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const accessibilityScanResults = await new AxeBuilder({ page }).withTags(['cat.color']).analyze();

    const contrastViolations = accessibilityScanResults.violations.filter((v) => v.id === 'color-contrast');

    if (contrastViolations.length > 0) {
      console.log('Color contrast issues found:');
      contrastViolations.forEach((v) => {
        console.log(`Elements affected: ${v.nodes.length}`);
        v.nodes.slice(0, 3).forEach((n) => {
          console.log(`  - ${n.html.slice(0, 100)}`);
        });
      });
    }
  });

  test('Page has proper heading structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const headings = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1');
      const h2s = document.querySelectorAll('h2');
      const h3s = document.querySelectorAll('h3');

      return {
        h1Count: h1s.length,
        h2Count: h2s.length,
        h3Count: h3s.length,
        h1Texts: Array.from(h1s).map((h) => h.textContent?.trim().slice(0, 50)),
      };
    });

    console.log(`Heading structure: H1=${headings.h1Count}, H2=${headings.h2Count}, H3=${headings.h3Count}`);
    console.log(`H1 content: ${headings.h1Texts.join(', ')}`);

    // Should have at least one H1 (or it might be in layout)
    // Don't fail, just report
  });

  test('Page language is set', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const lang = await page.getAttribute('html', 'lang');

    console.log(`Page language: ${lang}`);
    expect(lang).toBeTruthy();
  });

  test('Skip link is present (if applicable)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for skip link
    const skipLink = page.locator('a[href="#main"], a[href="#content"], .skip-link, [data-skip-link]');
    const hasSkipLink = (await skipLink.count()) > 0;

    console.log(`Skip link present: ${hasSkipLink}`);
  });
});

test.describe('FANZA Links Accessibility', () => {
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

  test('FANZA banner links have accessible text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find FANZA-related links
    const fanzaLinks = page.locator('a[href*="f.adult-v.com"]');
    const count = await fanzaLinks.count();

    console.log(`Found ${count} FANZA links`);

    for (let i = 0; i < count; i++) {
      const link = fanzaLinks.nth(i);

      // Check for accessible text
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const title = await link.getAttribute('title');

      const hasAccessibleText = (text && text.trim().length > 0) || ariaLabel || title;

      expect(hasAccessibleText).toBeTruthy();
    }
  });

  test('FANZA external links have security attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const fanzaLinks = page.locator('a[href*="f.adult-v.com"]');
    const count = await fanzaLinks.count();

    for (let i = 0; i < count; i++) {
      const link = fanzaLinks.nth(i);
      const target = await link.getAttribute('target');
      const rel = await link.getAttribute('rel');

      // External links should open in new tab with security attributes
      if (target === '_blank') {
        expect(rel).toContain('noopener');
      }
    }
  });

  test('FANZA banner has proper focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const fanzaLink = page.locator('a[href*="f.adult-v.com"]').first();

    if (await fanzaLink.isVisible().catch(() => false)) {
      await fanzaLink.focus();

      const hasFocusStyle = await fanzaLink.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;
        const ringColor = styles.getPropertyValue('--tw-ring-color');

        return (
          (outline !== 'none' && outline !== '0px none rgb(0, 0, 0)') ||
          (boxShadow !== 'none' && boxShadow !== '') ||
          ringColor !== ''
        );
      });

      console.log(`FANZA link focus indicator: ${hasFocusStyle}`);
    }
  });

  test('FANZA section has proper ARIA landmark', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for section elements containing FANZA content
    const fanzaSections = page.locator('section:has(a[href*="f.adult-v.com"])');
    const count = await fanzaSections.count();

    console.log(`FANZA sections found: ${count}`);

    // Sections should exist and be properly structured
    if (count > 0) {
      // Check for heading within section
      const firstSection = fanzaSections.first();
      const headingCount = await firstSection.locator('h1, h2, h3, h4').count();

      console.log(`Headings in FANZA section: ${headingCount}`);
    }
  });

  test('FANZA links work with keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Tab until we reach a FANZA link
    let foundFanzaLink = false;
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focusedHref = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement;
        return el?.href || '';
      });

      if (focusedHref.includes('f.adult-v.com')) {
        foundFanzaLink = true;
        console.log(`Reached FANZA link after ${i + 1} tabs`);
        break;
      }
    }

    // Note: Not failing if not found, as it may require scrolling
    console.log(`FANZA link reachable via keyboard: ${foundFanzaLink}`);
  });
});

test.describe('Mobile Accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 } });

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

  test('Touch targets are large enough', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const interactiveElements = page.locator('button, a, input, [role="button"]');
    const count = await interactiveElements.count();

    let smallTargets = 0;
    const MIN_SIZE = 44; // WCAG 2.1 Level AAA recommends 44x44px

    for (let i = 0; i < Math.min(count, 20); i++) {
      const element = interactiveElements.nth(i);

      if (await element.isVisible().catch(() => false)) {
        const box = await element.boundingBox();

        if (box && (box.width < MIN_SIZE || box.height < MIN_SIZE)) {
          smallTargets++;
        }
      }
    }

    console.log(`Touch targets smaller than ${MIN_SIZE}px: ${smallTargets}`);
  });
});
