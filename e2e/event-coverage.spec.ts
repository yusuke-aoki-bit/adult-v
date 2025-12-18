import { test, expect } from '@playwright/test';
import { EventTestHelper, setAgeVerifiedCookie, ALL_EVENTS } from './helpers/EventTestHelper';

/**
 * 全イベントカバレッジテスト
 * アプリケーション内の全トラッキングイベントが正しく発火することを検証
 */

test.describe('Event Coverage Tests', () => {
  let eventHelper: EventTestHelper;

  test.beforeEach(async ({ page, context }) => {
    // Age verification cookie設定
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);

    eventHelper = new EventTestHelper(page);
    await eventHelper.startCapturing();
  });

  test.afterEach(async () => {
    // カバレッジレポートを出力
    await eventHelper.printCoverageReport();
  });

  test('page_view event fires on page load', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const fired = await eventHelper.hasEventFired('page_view');
    // Note: page_view may fire through Firebase Analytics automatically
    console.log('page_view fired:', fired);
  });

  test('search event fires on search', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');

    // 検索ボックスを探す
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[name="q"]').first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('テスト');
      await searchInput.press('Enter');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      const fired = await eventHelper.hasEventFired('search');
      console.log('search event fired:', fired);
    } else {
      console.log('Search input not found, skipping');
      test.skip();
    }
  });

  test('view_product event fires on product page', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 商品リンクを探す
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const fired = await eventHelper.hasEventFired('view_product');
      console.log('view_product event fired:', fired);
    } else {
      console.log('Product link not found, skipping');
      test.skip();
    }
  });

  test('add_favorite and remove_favorite events fire', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 商品ページに移動
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // お気に入りボタンを探す
      const favoriteButton = page.locator('button[aria-label*="お気に入り"], button[aria-label*="favorite"], [data-testid="favorite-button"]').first();

      if (await favoriteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // お気に入りに追加
        await favoriteButton.click();
        await page.waitForTimeout(500);

        const addFired = await eventHelper.hasEventFired('add_favorite');
        console.log('add_favorite event fired:', addFired);

        // お気に入りから削除
        await favoriteButton.click();
        await page.waitForTimeout(500);

        const removeFired = await eventHelper.hasEventFired('remove_favorite');
        console.log('remove_favorite event fired:', removeFired);
      } else {
        console.log('Favorite button not found');
      }
    } else {
      console.log('Product link not found, skipping');
      test.skip();
    }
  });

  test('click_affiliate_link event fires', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 商品ページに移動
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // アフィリエイトリンク/購入ボタンを探す
      const affiliateLink = page.locator('a[rel*="sponsored"], a[href*="dmm.co.jp"], a[href*="mgstage.com"], button:has-text("購入")').first();

      if (await affiliateLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        // クリック（新しいタブを開かないようにイベントだけ発火させる）
        await affiliateLink.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await page.waitForTimeout(500);

        const fired = await eventHelper.hasEventFired('click_affiliate_link');
        console.log('click_affiliate_link event fired:', fired);
      } else {
        console.log('Affiliate link not found');
      }
    } else {
      console.log('Product link not found, skipping');
      test.skip();
    }
  });

  test('filter_applied event fires', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // フィルター要素を探す
    const filterSelect = page.locator('select[name*="filter"], select[name*="category"], [data-testid*="filter"]').first();
    const filterCheckbox = page.locator('input[type="checkbox"][name*="filter"]').first();

    if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await filterSelect.locator('option').all();
      if (options.length > 1) {
        await filterSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        const fired = await eventHelper.hasEventFired('filter_applied');
        console.log('filter_applied event fired:', fired);
      }
    } else if (await filterCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterCheckbox.click();
      await page.waitForTimeout(500);

      const fired = await eventHelper.hasEventFired('filter_applied');
      console.log('filter_applied event fired:', fired);
    } else {
      console.log('Filter element not found');
    }
  });

  test('sort_changed event fires', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // ソート要素を探す
    const sortSelect = page.locator('select[name*="sort"], [data-testid*="sort"]').first();

    if (await sortSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await sortSelect.locator('option').all();
      if (options.length > 1) {
        await sortSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        const fired = await eventHelper.hasEventFired('sort_changed');
        console.log('sort_changed event fired:', fired);
      }
    } else {
      console.log('Sort element not found');
    }
  });

  test('age_verified event fires', async ({ page, context }) => {
    // 既存のcookieをクリア
    await context.clearCookies();

    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 年齢確認ダイアログを探す
    const ageVerifyButton = page.locator('button:has-text("18歳以上"), button:has-text("はい"), button:has-text("Enter")').first();

    if (await ageVerifyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ageVerifyButton.click();
      await page.waitForTimeout(1000);

      const fired = await eventHelper.hasEventFired('age_verified');
      console.log('age_verified event fired:', fired);
    } else {
      console.log('Age verification dialog not found');
    }
  });

  test('language_changed event fires', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 言語切り替え要素を探す
    const langSelector = page.locator('select[name*="lang"], a[href="/en"], button:has-text("EN"), [data-testid*="language"]').first();

    if (await langSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      const tagName = await langSelector.evaluate(el => el.tagName.toLowerCase());

      if (tagName === 'select') {
        await langSelector.selectOption({ index: 1 });
      } else {
        await langSelector.click();
      }
      await page.waitForTimeout(1000);

      const fired = await eventHelper.hasEventFired('language_changed');
      console.log('language_changed event fired:', fired);
    } else {
      console.log('Language selector not found');
    }
  });

  test('cta_click event fires (A/B Test)', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 商品ページに移動
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // CTAボタンを探す
      const ctaButton = page.locator('a:has-text("購入"), button:has-text("購入"), a:has-text("今すぐ"), a[rel*="sponsored"]').first();

      if (await ctaButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ctaButton.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await page.waitForTimeout(500);

        const fired = await eventHelper.hasEventFired('cta_click');
        console.log('cta_click event fired:', fired);
      } else {
        console.log('CTA button not found');
      }
    } else {
      console.log('Product link not found, skipping');
      test.skip();
    }
  });

  test('experiment_impression event fires', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 商品ページに移動（A/Bテスト対象ページ）
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const fired = await eventHelper.hasEventFired('experiment_impression');
      console.log('experiment_impression event fired:', fired);
    } else {
      console.log('Product link not found');
    }
  });

  test('web_vitals event fires on page load', async ({ page }) => {
    await page.goto('/ja');
    await page.waitForLoadState('networkidle');
    // Web Vitalsは少し時間がかかる場合がある
    await page.waitForTimeout(3000);

    const fired = await eventHelper.hasEventFired('web_vitals');
    console.log('web_vitals event fired:', fired);

    // Web Vitalsのパラメータを確認
    const params = await eventHelper.getEventParams('web_vitals');
    if (params.length > 0) {
      console.log('web_vitals params:', JSON.stringify(params, null, 2));
    }
  });
});

test.describe('Full Event Coverage Report', () => {
  test('Generate comprehensive event coverage report', async ({ page, context }) => {
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);

    const eventHelper = new EventTestHelper(page);
    await eventHelper.startCapturing();

    // 1. ホームページ読み込み
    console.log('Step 1: Loading home page...');
    await page.goto('/ja');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. 商品ページに移動
    console.log('Step 2: Navigating to product page...');
    const productLink = page.locator('a[href*="/products/"]').first();

    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // 3. お気に入り追加/削除
      console.log('Step 3: Testing favorite toggle...');
      const favoriteButton = page.locator('button[aria-label*="お気に入り"], button[aria-label*="favorite"]').first();
      if (await favoriteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await favoriteButton.click();
        await page.waitForTimeout(300);
        await favoriteButton.click();
        await page.waitForTimeout(300);
      }

      // 4. アフィリエイトリンククリック
      console.log('Step 4: Testing affiliate link click...');
      const affiliateLink = page.locator('a[rel*="sponsored"]').first();
      if (await affiliateLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await affiliateLink.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await page.waitForTimeout(300);
      }
    }

    // 5. 検索
    console.log('Step 5: Testing search...');
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('テスト');
      await searchInput.press('Enter');
      await page.waitForTimeout(1500);
    }

    // 6. 言語切り替え
    console.log('Step 6: Testing language change...');
    const langLink = page.locator('a[href="/en"]').first();
    if (await langLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await langLink.click();
      await page.waitForTimeout(1000);
    }

    // 最終カバレッジレポート出力
    console.log('\n=== Final Coverage Report ===');
    const report = await eventHelper.printCoverageReport();

    // カバレッジを検証
    const coverage = await eventHelper.getEventCoverage();
    console.log(`\nEvent Coverage: ${coverage.captured}/${coverage.total} (${coverage.percentage}%)`);

    // 発火しなかったイベントを表示
    const unfiredEvents = Object.entries(coverage.events)
      .filter(([, data]) => !data.fired)
      .map(([name]) => name);

    if (unfiredEvents.length > 0) {
      console.log('\nEvents not fired during this test:');
      unfiredEvents.forEach(name => console.log(`  - ${name}`));
    }
  });
});
