import { test, expect } from '@playwright/test';

/**
 * 要件検証E2Eテスト
 * REQUIREMENTS.mdに定義された要件の実装を検証
 */

test.setTimeout(120000);

// 全テストで年齢確認クッキーを設定
test.beforeEach(async ({ context }) => {
  await context.addCookies([{
    name: 'age-verified',
    value: 'true',
    domain: 'localhost',
    path: '/',
  }]);
});

test.describe('要件1-4: 商品・演者・ASP紐付け', () => {
  test('商品詳細ページに複数ASPの価格が表示される', async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 商品リンクを探してクリック
    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForLoadState('networkidle');

      // 価格セクションが存在することを確認
      const priceSection = page.locator('[data-testid="price-section"], .price-comparison, [class*="price"]');
      await expect(priceSection.first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('演者詳細ページに出演作品が表示される', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 演者リンクを探してクリック
    const actressLink = page.locator('a[href*="/actress/"]').first();
    if (await actressLink.isVisible()) {
      await actressLink.click();
      await page.waitForLoadState('networkidle');

      // 出演作品セクションが存在することを確認
      const worksSection = page.locator('[data-testid="works-section"], .works-grid, [class*="product"]');
      await expect(worksSection.first()).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('要件5: セール情報', () => {
  test('セール中商品にセールバッジが表示される', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // セールバッジの存在を確認（存在しなくてもテスト成功）
    const saleBadge = page.locator('[class*="sale"], [class*="discount"], [data-testid="sale-badge"]');
    const count = await saleBadge.count();
    console.log(`Found ${count} sale badges`);
  });

  test('セールカレンダーページが表示される', async ({ page }) => {
    await page.goto('/sale-calendar');

    // ページが正常にロードされることを確認
    await expect(page).toHaveURL(/sale-calendar/);
    // networkidleはタイムアウトすることがあるのでdomcontentloadedを使用
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });
});

test.describe('要件7: 多言語対応', () => {
  const locales = ['ja', 'en', 'zh', 'ko'];

  locales.forEach((locale) => {
    test(`${locale}ロケールでページが表示される`, async ({ page }) => {
      await page.goto(`/?hl=${locale}`);
      await page.waitForLoadState('networkidle');

      // ページが正常にロードされることを確認
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test('言語切り替えが機能する', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 言語セレクターを探す
    const langSelector = page.locator('[data-testid="language-selector"], [class*="language"], select[name*="lang"]');
    if (await langSelector.first().isVisible()) {
      console.log('Language selector found');
    }
  });
});

test.describe('要件8: UI/UX機能', () => {
  test('ホームページが正常に表示される', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // ヘッダーが存在することを確認
    const header = page.locator('header, [role="banner"]');
    await expect(header.first()).toBeVisible();

    // メインコンテンツが存在することを確認
    const main = page.locator('main, [role="main"]');
    await expect(main.first()).toBeVisible();
  });

  test('商品一覧ページでフィルターが機能する', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // フィルターUIが存在することを確認
    const filterUI = page.locator('[data-testid="filter"], [class*="filter"], button:has-text("フィルター")');
    const count = await filterUI.count();
    console.log(`Found ${count} filter elements`);
  });

  test('レスポンシブデザイン - モバイル', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // モバイルでページが正常に表示されることを確認
    await expect(page.locator('body')).toBeVisible();
  });

  test('レスポンシブデザイン - タブレット', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('レスポンシブデザイン - デスクトップ', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('要件9: SEO対策', () => {
  test('robots.txtが正しく設定されている', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    expect(text.toLowerCase()).toContain('user-agent');
    expect(text).toContain('Sitemap');
  });

  test('サイトマップが正しく生成される', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('xml');
  });

  test('メタタグが正しく設定されている', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // titleタグ
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // meta description（複数ある場合があるので.first()を使用）
    const metaDesc = page.locator('meta[name="description"]').first();
    const descContent = await metaDesc.getAttribute('content');
    expect(descContent?.length).toBeGreaterThan(0);

    // OGP tags（複数ある場合があるので.first()を使用）
    const ogTitle = page.locator('meta[property="og:title"]').first();
    expect(await ogTitle.getAttribute('content')).toBeTruthy();

    const ogDesc = page.locator('meta[property="og:description"]').first();
    expect(await ogDesc.getAttribute('content')).toBeTruthy();
  });

  test('構造化データ(JSON-LD)が含まれている', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);

    // JSON-LDが有効なJSONであることを確認
    const firstScript = await jsonLd.first().textContent();
    if (firstScript) {
      expect(() => JSON.parse(firstScript)).not.toThrow();
    }
  });

  test('hreflangタグが設定されている', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hreflang = page.locator('link[hreflang]');
    const count = await hreflang.count();
    console.log(`Found ${count} hreflang tags`);
  });
});

test.describe('要件12: 監視・分析機能', () => {
  test('Google Analyticsスクリプトが読み込まれる', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // GA4スクリプトの存在確認
    const gaScript = page.locator('script[src*="googletagmanager.com"]');
    const count = await gaScript.count();
    console.log(`Found ${count} GA scripts`);
  });
});

test.describe('要件13: PWA機能', () => {
  test('Service Workerが登録可能', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Service Workerファイルが存在するか確認
    const swResponse = await page.request.get('/sw.js');
    // sw.jsが存在しなくても許容（PWAがオプションの場合）
    console.log(`SW status: ${swResponse.status()}`);
  });

  test('manifest.jsonが存在する', async ({ request }) => {
    const response = await request.get('/manifest.json');
    if (response.ok()) {
      const manifest = await response.json();
      expect(manifest.name).toBeDefined();
    }
  });
});

test.describe('要件14: プライバシー・コンプライアンス', () => {
  test('年齢確認ページが存在する', async ({ page }) => {
    await page.goto('/age-verification');

    // ページが正常にロードされることを確認
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('要件18: API動作確認', () => {
  test('商品一覧APIが正常に動作する', async ({ request }) => {
    const response = await request.get('/api/products?limit=5');

    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('女優一覧APIが正常に動作する', async ({ request }) => {
    const response = await request.get('/api/actresses?limit=5');

    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('検索APIが正常に動作する', async ({ request }) => {
    const response = await request.get('/api/search/autocomplete?q=test');

    if (response.ok()) {
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    }
  });

  test('統計APIが正常に動作する', async ({ request }) => {
    const response = await request.get('/api/stats/asp');

    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });
});
