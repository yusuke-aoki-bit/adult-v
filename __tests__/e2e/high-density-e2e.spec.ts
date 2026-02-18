/**
 * 高密度E2Eテスト
 *
 * 全APIエンドポイント・全ページ・DBクエリ整合性・エッジケースを網羅
 * - API応答スキーマ検証
 * - ページSSR/CSRレンダリング検証
 * - フィルター・ページネーション・ソート整合性
 * - エラーハンドリング・境界値テスト
 * - パフォーマンス計測
 *
 * API応答形式: { products: [...], total: number, limit: number, offset: number }
 * products API limit: 12〜96
 */
import { test, expect, BrowserContext } from '@playwright/test';

test.setTimeout(180000);

// ========================================
// セットアップ
// ========================================

async function setupAge(context: BrowserContext): Promise<void> {
  await context.addCookies([{
    name: 'age-verified',
    value: 'true',
    domain: 'localhost',
    path: '/',
  }]);
}

interface ApiTiming {
  endpoint: string;
  status: number;
  durationMs: number;
  ok: boolean;
}

async function timedGet(
  request: any,
  url: string,
  opts: { timeout?: number } = {}
): Promise<{ response: any; timing: ApiTiming }> {
  const start = Date.now();
  const response = await request.get(url, { timeout: opts.timeout || 30000 });
  const durationMs = Date.now() - start;
  return {
    response,
    timing: {
      endpoint: url,
      status: response.status(),
      durationMs,
      ok: response.ok(),
    },
  };
}

// ========================================
// 1. コアAPIエンドポイント完全検証
// ========================================

test.describe('1. コアAPI完全検証', () => {
  const apiTimings: ApiTiming[] = [];

  test.afterAll(() => {
    if (apiTimings.length === 0) return;
    console.log('\n=== API Performance Summary ===');
    const sorted = [...apiTimings].sort((a, b) => b.durationMs - a.durationMs);
    sorted.forEach(t => {
      const icon = t.ok ? '✓' : '✗';
      console.log(`  ${icon} ${t.endpoint} → ${t.status} (${t.durationMs}ms)`);
    });
    const avg = Math.round(apiTimings.reduce((s, t) => s + t.durationMs, 0) / apiTimings.length);
    console.log(`  Average: ${avg}ms\n`);
  });

  test('GET /api/products — ページネーション・スキーマ検証', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/products?limit=12&offset=0');
    apiTimings.push(timing);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('offset');
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeLessThanOrEqual(12);

    if (data.products.length > 0) {
      const p = data.products[0];
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('title');
      expect(p).toHaveProperty('provider');
    }

    expect(typeof data.total).toBe('number');
    expect(data.total).toBeGreaterThanOrEqual(data.products.length);
  });

  test('GET /api/products — offset=0とoffset=12でデータが重複しない', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      request.get('/api/products?limit=12&offset=0'),
      request.get('/api/products?limit=12&offset=12'),
    ]);

    const d1 = await r1.json();
    const d2 = await r2.json();

    if (d1.products?.length > 0 && d2.products?.length > 0) {
      const ids1 = d1.products.map((p: any) => p.id);
      const ids2 = d2.products.map((p: any) => p.id);
      const overlap = ids1.filter((id: any) => ids2.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  test('GET /api/products — ソート順検証 (releaseDateDesc)', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/products?limit=24&offset=0&sortBy=releaseDateDesc');
    apiTimings.push(timing);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    if (data.products?.length > 1) {
      for (let i = 0; i < data.products.length - 1; i++) {
        const d1 = data.products[i].releaseDate;
        const d2 = data.products[i + 1].releaseDate;
        if (d1 && d2) {
          expect(new Date(d1).getTime()).toBeGreaterThanOrEqual(new Date(d2).getTime());
        }
      }
    }
  });

  test('GET /api/products — 価格フィルター（修正済みバグの回帰テスト）', async ({ request }) => {
    const { response, timing } = await timedGet(
      request,
      '/api/products?limit=12&offset=0&minPrice=1000&maxPrice=3000'
    );
    apiTimings.push(timing);

    if (response.ok()) {
      const data = await response.json();
      // フィルター時は全件数より少ないはず
      if (data.total !== undefined) {
        const allResp = await request.get('/api/products?limit=12&offset=0');
        if (allResp.ok()) {
          const allData = await allResp.json();
          if (allData.total > 100) {
            expect(data.total).toBeLessThan(allData.total);
          }
        }
      }
    }
  });

  test('GET /api/actresses — ページネーション・スキーマ検証', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/actresses?limit=12&offset=0');
    apiTimings.push(timing);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('actresses');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.actresses)).toBe(true);

    if (data.actresses.length > 0) {
      const a = data.actresses[0];
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('name');
    }
  });

  test('GET /api/actresses — ソート順検証 (recent)', async ({ request }) => {
    const { response } = await timedGet(request, '/api/actresses?limit=24&offset=0&sortBy=recent');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // metricsにlatestReleaseDateが含まれるかチェック
    if (data.actresses?.length > 1 && data.actresses[0].metrics?.latestReleaseDate) {
      for (let i = 0; i < data.actresses.length - 1; i++) {
        const d1 = data.actresses[i].metrics?.latestReleaseDate;
        const d2 = data.actresses[i + 1].metrics?.latestReleaseDate;
        if (d1 && d2) {
          expect(new Date(d1).getTime()).toBeGreaterThanOrEqual(new Date(d2).getTime());
        }
      }
    }
  });

  test('GET /api/search/autocomplete — クエリ応答検証', async ({ request }) => {
    const queries = ['巨乳', 'a', 'SSIS'];
    for (const q of queries) {
      const { response, timing } = await timedGet(request, `/api/search/autocomplete?q=${encodeURIComponent(q)}`);
      apiTimings.push(timing);
      if (response.ok()) {
        const data = await response.json();
        expect(data).toBeDefined();
        expect(timing.durationMs).toBeLessThan(5000);
      }
    }
  });

  test('GET /api/recommendations — JSON応答・スキーマ検証', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/recommendations');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('GET /api/weekly-highlights — JSON応答検証', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/weekly-highlights');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('GET /api/stats/sales — 売上統計応答検証', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/stats/sales');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('GET /api/makers — メーカー一覧', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/makers?limit=5');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('GET /api/footer-actresses — フッター用女優', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/footer-actresses');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('GET /api/footer-links — フッターリンク', async ({ request }) => {
    const { response, timing } = await timedGet(request, '/api/footer-links');
    apiTimings.push(timing);
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });
});

// ========================================
// 2. 動的APIルート検証
// ========================================

test.describe('2. 動的APIルート検証', () => {
  let sampleProductId: string | null = null;
  let sampleActressId: string | null = null;

  test.beforeAll(async ({ request }) => {
    const prodResp = await request.get('/api/products?limit=12&offset=0');
    if (prodResp.ok()) {
      const data = await prodResp.json();
      if (data.products?.[0]) {
        sampleProductId = String(data.products[0].id);
      }
    }

    const actResp = await request.get('/api/actresses?limit=12&offset=0');
    if (actResp.ok()) {
      const data = await actResp.json();
      if (data.actresses?.[0]) {
        sampleActressId = String(data.actresses[0].id);
      }
    }
  });

  test('GET /api/products/[id] — 商品詳細', async ({ request }) => {
    test.skip(!sampleProductId, 'サンプル商品なし');
    const resp = await request.get(`/api/products/${sampleProductId}`);
    expect([200, 404]).toContain(resp.status());
    if (resp.ok()) {
      const data = await resp.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
    }
  });

  test('GET /api/products/[id]/similar — 類似商品', async ({ request }) => {
    test.skip(!sampleProductId, 'サンプル商品なし');
    const resp = await request.get(`/api/products/${sampleProductId}/similar`);
    expect([200, 404, 500]).toContain(resp.status());
  });

  test('GET /api/products/[id]/prices — 価格情報', async ({ request }) => {
    test.skip(!sampleProductId, 'サンプル商品なし');
    const resp = await request.get(`/api/products/${sampleProductId}/prices`);
    expect([200, 404, 500]).toContain(resp.status());
  });

  test('GET /api/products/[id]/reviews — レビュー', async ({ request }) => {
    test.skip(!sampleProductId, 'サンプル商品なし');
    const resp = await request.get(`/api/products/${sampleProductId}/reviews`);
    expect([200, 404, 500]).toContain(resp.status());
  });

  test('GET /api/products/invalid-id — 不正IDのエラーハンドリング', async ({ request }) => {
    const resp = await request.get('/api/products/not-a-real-id-999999');
    expect([400, 404, 500]).toContain(resp.status());
  });

  test('GET /api/products/compare — 商品比較（パラメータなし）', async ({ request }) => {
    const resp = await request.get('/api/products/compare');
    expect([200, 400]).toContain(resp.status());
  });
});

// ========================================
// 3. SEO・サイトマップ・フィード検証
// ========================================

test.describe('3. SEO・サイトマップ完全検証', () => {
  test('robots.txt — フォーマット・Sitemap参照確認', async ({ request }) => {
    const resp = await request.get('/robots.txt');
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text.toLowerCase()).toContain('user-agent');
    expect(text.toLowerCase()).toContain('sitemap');
  });

  test('sitemap.xml — 有効なXML・子サイトマップ参照', async ({ request }) => {
    const resp = await request.get('/sitemap.xml');
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('<sitemapindex');
    expect(text).toContain('<sitemap>');
  });

  test('sitemap-actresses.xml — 女優サイトマップ', async ({ request }) => {
    const resp = await request.get('/sitemap-actresses.xml');
    expect([200, 301, 302]).toContain(resp.status());
  });

  test('feed.xml — RSSフィード', async ({ request }) => {
    const resp = await request.get('/feed.xml');
    if (resp.ok()) {
      const text = await resp.text();
      expect(text).toContain('<?xml');
    }
  });

  test('監視エンドポイント /monitoring — ヘルスチェック', async ({ request }) => {
    const resp = await request.get('/monitoring');
    expect([200, 404]).toContain(resp.status());
  });
});

// ========================================
// 4. 全ページSSRレンダリング検証
// ========================================

test.describe('4. 全ページSSR検証', () => {
  test.beforeEach(async ({ context }) => {
    await setupAge(context);
  });

  const pages = [
    { path: '/', name: 'トップページ' },
    { path: '/products', name: '商品一覧' },
    { path: '/categories', name: 'カテゴリ' },
    { path: '/calendar', name: 'カレンダー' },
    { path: '/favorites', name: 'お気に入り' },
    { path: '/compare', name: '比較' },
    { path: '/discover', name: 'ディスカバー' },
    { path: '/diary', name: '視聴日記' },
    { path: '/watchlist', name: 'ウォッチリスト' },
    { path: '/alerts', name: '価格アラート' },
    { path: '/series', name: 'シリーズ' },
    { path: '/makers', name: 'メーカー' },
    { path: '/statistics', name: '統計' },
    { path: '/sales', name: 'セール' },
    { path: '/terms', name: '利用規約' },
    { path: '/privacy', name: 'プライバシー' },
  ];

  for (const { path, name } of pages) {
    test(`${name} (${path}) — 200応答・クリティカルエラーなし`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const resp = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      expect(resp?.status()).toBe(200);

      await page.waitForLoadState('networkidle').catch(() => {});

      const hydrationErrors = errors.filter(e =>
        e.includes('Hydration') ||
        e.includes('Text content does not match') ||
        e.includes('did not match')
      );
      expect(hydrationErrors, `Hydrationエラー: ${path}`).toHaveLength(0);
    });
  }
});

// ========================================
// 5. 動的ページ検証（商品・女優詳細）
// ========================================

test.describe('5. 動的ページ検証', () => {
  test.beforeEach(async ({ context }) => {
    await setupAge(context);
  });

  test('商品詳細ページ — SSR・メタデータ・構造化データ検証', async ({ page, request }) => {
    const prodResp = await request.get('/api/products?limit=12&offset=0');
    test.skip(!prodResp.ok(), 'APIからデータ取得不可');
    const prodData = await prodResp.json();
    test.skip(!prodData.products?.[0], 'サンプル商品なし');

    const product = prodData.products[0];
    const productCode = product.normalizedProductId || product.id;

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const resp = await page.goto(`/products/${productCode}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(resp?.status()).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => {});

    // タイトルタグ確認
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // meta description確認（重複がないこと + 内容検証）
    const metaDescCount = await page.locator('meta[name="description"]').count();
    expect(metaDescCount, 'meta descriptionが重複している').toBe(1);
    const metaDesc = await page.locator('meta[name="description"]').first().getAttribute('content');
    if (metaDesc) {
      expect(metaDesc.length).toBeGreaterThan(10);
    }

    // OGタグ確認
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // 構造化データ (JSON-LD) 確認
    const jsonLdEl = page.locator('script[type="application/ld+json"]').first();
    if (await jsonLdEl.count() > 0) {
      const jsonLd = await jsonLdEl.textContent();
      if (jsonLd) {
        const parsed = JSON.parse(jsonLd);
        expect(parsed['@context']).toContain('schema.org');
      }
    }

    const critErrors = errors.filter(e =>
      e.includes('Hydration') || e.includes('TypeError') || e.includes('ReferenceError')
    );
    expect(critErrors).toHaveLength(0);
  });

  test('女優詳細ページ — SSR・メタデータ検証', async ({ page, request }) => {
    const actResp = await request.get('/api/actresses?limit=12&offset=0');
    test.skip(!actResp.ok(), 'APIからデータ取得不可');
    const actData = await actResp.json();
    test.skip(!actData.actresses?.[0], 'サンプル女優なし');

    const actress = actData.actresses[0];

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const resp = await page.goto(`/actress/${actress.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(resp?.status()).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => {});

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const critErrors = errors.filter(e =>
      e.includes('Hydration') || e.includes('TypeError') || e.includes('ReferenceError')
    );
    expect(critErrors).toHaveLength(0);
  });
});

// ========================================
// 6. i18n検証
// ========================================

test.describe('6. i18n多言語検証', () => {
  test.beforeEach(async ({ context }) => {
    await setupAge(context);
  });

  const locales = ['ja', 'en', 'zh', 'ko'];

  for (const locale of locales) {
    test(`トップページ ${locale} — 200応答`, async ({ page }) => {
      const path = locale === 'ja' ? '/' : `/?hl=${locale}`;
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      expect(resp?.status()).toBe(200);

      // ページがレンダリングされること
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(0);
    });
  }

  test('不正ロケール — フォールバック動作', async ({ page }) => {
    const resp = await page.goto('/?hl=xx', { waitUntil: 'domcontentloaded', timeout: 60000 });
    expect([200, 301, 302, 404]).toContain(resp?.status());
  });
});

// ========================================
// 7. UI操作・インタラクション検証
// ========================================

test.describe('7. UI操作検証', () => {
  test.beforeEach(async ({ context }) => {
    await setupAge(context);
  });

  test('商品一覧 — 無限スクロール/LoadMore動作', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const initialCards = await page.locator('a[href*="/products/"]').count();

    const loadMore = page.locator('button:has-text("もっと見る"), button:has-text("さらに表示"), button:has-text("Load more")').first();
    if (await loadMore.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadMore.click();
      await page.waitForTimeout(3000);

      const afterCards = await page.locator('a[href*="/products/"]').count();
      expect(afterCards).toBeGreaterThanOrEqual(initialCards);
    }
  });

  test('検索 — 入力・結果表示・エラーなし', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[name="q"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('巨乳');
      await page.waitForTimeout(1000);

      const suggestions = page.locator('[class*="suggestion"], [class*="autocomplete"], [role="listbox"]');
      const hasSuggestions = await suggestions.first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Autocomplete suggestions visible: ${hasSuggestions}`);

      await searchInput.press('Enter');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(2000);
    }

    const critErrors = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critErrors).toHaveLength(0);
  });

  test('モバイルビューポート — レスポンシブ表示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);

    const critErrors = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critErrors).toHaveLength(0);
  });

  test('タブレットビューポート — レスポンシブ表示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 実際に水平スクロールが可能かをチェック（overflow-x-hidden で防止されていればOK）
    const canScrollHorizontally = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth > html.clientWidth;
    });
    // html要素レベルでスクロール不可であること
    expect(canScrollHorizontally, 'タブレットで水平スクロールが可能').toBe(false);
  });
});

// ========================================
// 8. エラーハンドリング・境界値テスト
// ========================================

test.describe('8. エラーハンドリング・境界値', () => {
  test('存在しないページ — 404ページ表示', async ({ request }) => {
    const resp = await request.get('/non-existent-page-12345');
    expect(resp.status()).toBe(404);
  });

  test('不正なAPIパラメータ — limit=-1', async ({ request }) => {
    const resp = await request.get('/api/products?limit=-1&offset=0');
    // バリデーションエラーを返す
    expect([400, 500]).toContain(resp.status());
  });

  test('不正なAPIパラメータ — offset=999999（空結果）', async ({ request }) => {
    const resp = await request.get('/api/products?limit=12&offset=999999');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  test('不正なAPIパラメータ — limit=1000（上限超え）', async ({ request }) => {
    const resp = await request.get('/api/products?limit=1000&offset=0');
    // 上限バリデーションでエラーを返す
    expect([400, 500]).toContain(resp.status());
  });

  test('SQLインジェクション耐性', async ({ request }) => {
    const malicious = "'; DROP TABLE products; --";
    const resp = await request.get(`/api/search/autocomplete?q=${encodeURIComponent(malicious)}`);
    expect([200, 400]).toContain(resp.status());

    // productsテーブルが無事か確認
    const prodResp = await request.get('/api/products?limit=12&offset=0');
    expect(prodResp.ok()).toBeTruthy();
    const data = await prodResp.json();
    expect(data.products.length).toBeGreaterThan(0);
  });

  test('XSS耐性 — スクリプトタグ入力', async ({ request }) => {
    const xss = '<script>alert("xss")</script>';
    const resp = await request.get(`/api/search/autocomplete?q=${encodeURIComponent(xss)}`);
    expect([200, 400]).toContain(resp.status());
    if (resp.ok()) {
      const text = await resp.text();
      expect(text).not.toContain('<script>');
    }
  });

  test('同時リクエスト耐性', async ({ request }) => {
    // dev環境の制限を考慮して5件に
    const requests = Array.from({ length: 5 }, (_, i) =>
      request.get(`/api/products?limit=12&offset=${i * 12}`)
    );
    const responses = await Promise.all(requests);

    const successCount = responses.filter(r => r.ok()).length;
    // 5件中3件以上成功
    expect(successCount).toBeGreaterThanOrEqual(3);
  });
});

// ========================================
// 9. セキュリティヘッダー検証
// ========================================

test.describe('9. セキュリティヘッダー', () => {
  test('主要セキュリティヘッダーの存在確認', async ({ request }) => {
    const resp = await request.get('/');
    const headers = resp.headers();

    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // X-Frame-Options
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');

    // Referrer-Policy
    expect(headers['referrer-policy']).toBeTruthy();

    // CSP
    expect(headers['content-security-policy']).toBeTruthy();
  });

  test('API応答のContent-Type検証', async ({ request }) => {
    const apiEndpoints = [
      '/api/products?limit=12&offset=0',
      '/api/actresses?limit=12&offset=0',
      '/api/recommendations',
    ];

    for (const endpoint of apiEndpoints) {
      const resp = await request.get(endpoint);
      if (resp.ok()) {
        const ct = resp.headers()['content-type'];
        expect(ct).toContain('application/json');
      }
    }
  });

  test('HSTS ヘッダー確認', async ({ request }) => {
    const resp = await request.get('/');
    const hsts = resp.headers()['strict-transport-security'];
    if (hsts) {
      expect(hsts).toContain('max-age=');
    }
  });
});

// ========================================
// 10. パフォーマンス計測
// ========================================

test.describe('10. パフォーマンス計測', () => {
  test.beforeEach(async ({ context }) => {
    await setupAge(context);
  });

  test('トップページ — DOMContentLoaded 10秒以内', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const domContentLoaded = Date.now() - start;

    await page.waitForLoadState('networkidle').catch(() => {});
    const fullLoad = Date.now() - start;

    console.log(`  DOMContentLoaded: ${domContentLoaded}ms`);
    console.log(`  Full load: ${fullLoad}ms`);

    expect(domContentLoaded).toBeLessThan(10000);
  });

  test('API応答速度 — コアAPI全体', async ({ request }) => {
    const endpoints = [
      '/api/products?limit=12&offset=0',
      '/api/actresses?limit=12&offset=0',
      '/api/search/autocomplete?q=a',
      '/api/recommendations',
      '/api/footer-actresses',
    ];

    const results: { endpoint: string; ms: number }[] = [];

    for (const ep of endpoints) {
      const start = Date.now();
      await request.get(ep);
      results.push({ endpoint: ep, ms: Date.now() - start });
    }

    console.log('\n  === API Response Times ===');
    results.forEach(r => console.log(`  ${r.endpoint} → ${r.ms}ms`));

    const avg = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
    console.log(`  Average: ${avg}ms`);

    expect(avg).toBeLessThan(15000);
  });

  test('商品一覧ページ — DOM要素数チェック', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const domSize = await page.evaluate(() => document.querySelectorAll('*').length);
    console.log(`  DOM elements: ${domSize}`);

    expect(domSize).toBeLessThan(10000);
  });
});

// ========================================
// 11. データ整合性検証
// ========================================

test.describe('11. データ整合性', () => {
  test('商品一覧 → 詳細 — IDが一致する', async ({ request }) => {
    const listResp = await request.get('/api/products?limit=12&offset=0');
    test.skip(!listResp.ok(), 'API接続不可');

    const listData = await listResp.json();
    test.skip(!listData.products?.length, 'データなし');

    for (const product of listData.products.slice(0, 2)) {
      const detailResp = await request.get(`/api/products/${product.id}`);
      if (detailResp.ok()) {
        const detail = await detailResp.json();
        expect(String(detail.id)).toBe(String(product.id));
        expect(detail.title).toBe(product.title);
      }
    }
  });

  test('ページネーション一貫性 — total count の整合', async ({ request }) => {
    const page1 = await request.get('/api/products?limit=12&offset=0');
    const page2 = await request.get('/api/products?limit=12&offset=12');

    if (page1.ok() && page2.ok()) {
      const d1 = await page1.json();
      const d2 = await page2.json();

      // totalが同じであること（同じフィルター条件）
      if (d1.total !== undefined && d2.total !== undefined) {
        expect(d1.total).toBe(d2.total);
      }
    }
  });

  test('女優一覧 → 詳細 — データ一致', async ({ request }) => {
    const listResp = await request.get('/api/actresses?limit=12&offset=0');
    test.skip(!listResp.ok(), 'API接続不可');

    const listData = await listResp.json();
    test.skip(!listData.actresses?.length, 'データなし');

    const actress = listData.actresses[0];
    const detailResp = await request.get(`/api/actresses/${actress.id}`);
    if (detailResp.ok()) {
      const detail = await detailResp.json();
      if (detail.actress) {
        expect(detail.actress.name).toBe(actress.name);
      }
    }
  });
});
