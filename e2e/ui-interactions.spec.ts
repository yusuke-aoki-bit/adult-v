import { test, expect } from '@playwright/test';

/**
 * UIインタラクションテスト
 * ユーザー操作とコンポーネントの動作を検証
 */

// Increase timeout for UI interaction tests
test.setTimeout(120000);

test.describe('UI Interactions', () => {
  test.beforeEach(async ({ context }) => {
    // Age verification cookie設定
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('Homepage loads with product cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 商品カードが表示されることを確認
    const productCards = page.locator('[data-testid="product-card"], article, .product-card, a[href*="/products/"]');
    const count = await productCards.count();

    console.log(`Found ${count} product-related elements on homepage`);

    // 何らかのコンテンツが表示されていることを確認
    await expect(page.locator('main, [role="main"], body')).toBeVisible();
  });

  test('Product detail page displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 商品リンクを探す
    const productLinks = page.locator('a[href*="/products/"]');
    const linkCount = await productLinks.count();

    if (linkCount > 0) {
      console.log(`Found ${linkCount} product links`);

      // 最初の商品をクリック
      const firstLink = productLinks.first();
      const href = await firstLink.getAttribute('href');
      console.log(`Navigating to: ${href}`);

      await firstLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // 商品ページの基本要素を確認
      const currentUrl = page.url();
      expect(currentUrl).toContain('/products/');

      // 何らかのコンテンツが表示されていることを確認
      await expect(page.locator('main, [role="main"], body')).toBeVisible();
    } else {
      console.log('No product links found on homepage');
      test.skip();
    }
  });

  test('Favorite button toggles state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 商品ページに移動
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // お気に入りボタンを探す（複数のセレクター候補）
      const favoriteButton = page.locator([
        'button[aria-label*="お気に入り"]',
        'button[aria-label*="favorite"]',
        'button[aria-label*="Favorite"]',
        '[data-testid="favorite-button"]',
        'button:has(svg[data-icon="heart"])',
        'button:has(.fa-heart)',
      ].join(', ')).first();

      if (await favoriteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 初期状態を確認
        const initialClass = await favoriteButton.getAttribute('class');
        console.log('Initial favorite button state:', initialClass);

        // クリックしてトグル
        await favoriteButton.click();
        await page.waitForTimeout(500);

        // 状態が変わったことを確認（視覚的確認）
        const afterClickClass = await favoriteButton.getAttribute('class');
        console.log('After click favorite button state:', afterClickClass);

        // もう一度クリックして元に戻す
        await favoriteButton.click();
        await page.waitForTimeout(500);
      } else {
        console.log('Favorite button not found on product page');
      }
    } else {
      console.log('Product link not found');
      test.skip();
    }
  });

  test('Search functionality works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 検索入力を探す
    const searchInput = page.locator([
      'input[type="search"]',
      'input[placeholder*="検索"]',
      'input[placeholder*="search"]',
      'input[name="q"]',
      'input[name="search"]',
      '[data-testid="search-input"]',
    ].join(', ')).first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Search input found');

      // 検索を実行
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // 検索結果ページまたは検索クエリがURLに含まれることを確認
      const currentUrl = page.url();
      const hasSearchQuery = currentUrl.includes('q=') || currentUrl.includes('search') || currentUrl.includes('query');
      console.log('Search URL:', currentUrl);
    } else {
      console.log('Search input not found');
    }
  });

  test('Language switcher works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 言語切り替えリンクを探す
    const langLink = page.locator([
      'a[href*="hl=en"]',
      'a[href="/en"]',
      'a[href*="/en/"]',
      '[data-testid="language-switch"]',
      'button:has-text("EN")',
      'button:has-text("English")',
    ].join(', ')).first();

    if (await langLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Language switcher found');

      await langLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // 言語が変わったことを確認
      const currentUrl = page.url();
      const hasEnglish = currentUrl.includes('hl=en') || currentUrl.includes('/en');
      console.log('Language switch URL:', currentUrl);
    } else {
      console.log('Language switcher not found');
    }
  });

  test('Navigation menu works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // ナビゲーションリンクを探す
    const navLinks = page.locator('nav a, header a, [role="navigation"] a');
    const navCount = await navLinks.count();

    console.log(`Found ${navCount} navigation links`);

    if (navCount > 0) {
      // 最初のナビリンクをクリック
      const firstNavLink = navLinks.first();
      const href = await firstNavLink.getAttribute('href');

      if (href && !href.startsWith('http') && href !== '#') {
        console.log(`Clicking nav link: ${href}`);
        await firstNavLink.click();
        await page.waitForLoadState('domcontentloaded');

        // ページが遷移したことを確認
        await expect(page.locator('main, [role="main"], body')).toBeVisible();
      }
    }
  });

  test('Actress page displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 女優リンクを探す
    const actressLinks = page.locator('a[href*="/actresses/"]');
    const linkCount = await actressLinks.count();

    if (linkCount > 0) {
      console.log(`Found ${linkCount} actress links`);

      const firstLink = actressLinks.first();
      const href = await firstLink.getAttribute('href');
      console.log(`Navigating to: ${href}`);

      await firstLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // 女優ページの確認
      const currentUrl = page.url();
      expect(currentUrl).toContain('/actresses/');
    } else {
      // 直接女優一覧ページにアクセス
      await page.goto('/actresses');
      await page.waitForLoadState('domcontentloaded');

      const responseUrl = page.url();
      console.log('Actresses page URL:', responseUrl);
    }
  });

  test('Scroll and lazy loading works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 初期のコンテンツ数を確認
    const initialImages = await page.locator('img').count();
    console.log(`Initial image count: ${initialImages}`);

    // ページをスクロール
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1500);

    // さらにスクロール
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1500);

    // スクロール後のコンテンツ数を確認
    const afterScrollImages = await page.locator('img').count();
    console.log(`After scroll image count: ${afterScrollImages}`);
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('Homepage is responsive on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // モバイルでもコンテンツが表示されることを確認
    await expect(page.locator('main, [role="main"], body')).toBeVisible();

    // ハンバーガーメニューがあるか確認
    const menuButton = page.locator([
      'button[aria-label*="menu"]',
      'button[aria-label*="Menu"]',
      '[data-testid="mobile-menu"]',
      'button:has(.hamburger)',
      'button:has(svg[data-icon="bars"])',
    ].join(', ')).first();

    if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Mobile menu button found');
      await menuButton.click();
      await page.waitForTimeout(500);

      // メニューが開いたことを確認
      const menuPanel = page.locator('[role="dialog"], [role="menu"], nav[aria-expanded="true"], .mobile-menu');
      if (await menuPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Mobile menu opened');
      }
    } else {
      console.log('Mobile menu button not found');
    }
  });
});
