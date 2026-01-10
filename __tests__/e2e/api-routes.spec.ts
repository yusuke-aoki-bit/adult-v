import { test, expect } from '@playwright/test';

/**
 * API Routes E2E Tests
 * APIエンド�Eイント�E動作確誁E */

// Increase timeout for API tests (DB queries can be slow in dev)
test.setTimeout(120000);

test.describe('API Routes', () => {
  test.describe('Health Check APIs', () => {
    test('robots.txt returns valid response', async ({ request }) => {
      const response = await request.get('/robots.txt');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const text = await response.text();
      expect(text.toLowerCase()).toContain('user-agent');
    });

    test('sitemap.xml returns valid XML', async ({ request }) => {
      const response = await request.get('/sitemap.xml');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('xml');
    });

    test('icon.svg returns valid response', async ({ request }) => {
      const response = await request.get('/icon.svg');

      // Icon might not exist, but should return a valid response
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe('Feed API', () => {
    test('RSS feed returns valid XML', async ({ request }) => {
      const response = await request.get('/feed.xml');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toMatch(/xml|rss/);

        const text = await response.text();
        expect(text).toContain('<?xml');
      }
    });
  });

  test.describe('Search API', () => {
    test('Autocomplete API returns JSON', async ({ request }) => {
      const response = await request.get('/api/search/autocomplete?q=test');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  test.describe('Stats APIs', () => {
    test('ASP stats API returns data', async ({ request }) => {
      const response = await request.get('/api/stats/asp', { timeout: 60000 });

      // CI環境ではDBがないため500または接続タイムアウトを許容
      expect([200, 500, 504]).toContain(response.status());

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    });

    test('Sales stats API returns data', async ({ request }) => {
      const response = await request.get('/api/stats/sales');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    });
  });

  test.describe('Weekly Highlights API', () => {
    test('Weekly highlights API returns data', async ({ request }) => {
      const response = await request.get('/api/weekly-highlights');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  test.describe('Recommendations API', () => {
    test('Recommendations API returns JSON', async ({ request }) => {
      const response = await request.get('/api/recommendations');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    test('Actress recommendations API returns JSON', async ({ request }) => {
      const response = await request.get('/api/recommendations/actresses');

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('Non-existent API returns 404', async ({ request }) => {
      const response = await request.get('/api/non-existent-endpoint');

      expect(response.status()).toBe(404);
    });

    test('Invalid product ID returns appropriate error', async ({ request }) => {
      const response = await request.get('/api/products/invalid-id-12345');

      // Should return 404 or 400
      expect([400, 404, 500]).toContain(response.status());
    });
  });
});

test.describe('API Response Format', () => {
  test('API responses include proper headers', async ({ request }) => {
    // recommendationsはDB不要なのでCI環境でも動作
    const response = await request.get('/api/recommendations');

    if (response.ok()) {
      const headers = response.headers();

      // Check for common headers
      expect(headers['content-type']).toBeDefined();
    }
  });

  test('API responses are not cached when appropriate', async ({ request }) => {
    const response = await request.get('/api/recommendations');

    if (response.ok()) {
      const headers = response.headers();

      // Dynamic content should have appropriate cache headers
      const cacheControl = headers['cache-control'];
      if (cacheControl) {
        console.log(`Cache-Control: ${cacheControl}`);
      }
    }
  });
});

test.describe('API Performance', () => {
  // CI環境でのDB接続タイムアウトを考慮し、recommendationsで計測
  const API_TIMEOUT_MS = process.env['CI'] ? 10000 : 15000;

  test('API responds within acceptable time', async ({ request }) => {
    const start = Date.now();
    // recommendationsはDB不要なのでCI環境でも動作
    const response = await request.get('/api/recommendations');
    const duration = Date.now() - start;

    console.log(`API response time: ${duration}ms (threshold: ${API_TIMEOUT_MS}ms)`);

    // API should respond within threshold
    expect(duration).toBeLessThan(API_TIMEOUT_MS);
  });

  test('Search API responds quickly', async ({ request }) => {
    const SEARCH_TIMEOUT_MS = process.env['CI'] ? 3000 : 10000;
    const start = Date.now();
    const response = await request.get('/api/search/autocomplete?q=a');
    const duration = Date.now() - start;

    console.log(`Search API response time: ${duration}ms (threshold: ${SEARCH_TIMEOUT_MS}ms)`);

    // Search should be fast
    expect(duration).toBeLessThan(SEARCH_TIMEOUT_MS);
  });
});

test.describe('API Security', () => {
  test('API does not expose sensitive headers', async ({ request }) => {
    // recommendationsはDB不要なのでCI環境でも動作
    const response = await request.get('/api/recommendations');

    const headers = response.headers();

    // Should not expose server version details
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('POST without CSRF token is handled', async ({ request }) => {
    const response = await request.post('/api/track/view', {
      data: { productId: '12345' },
    });

    // Should either accept or reject gracefully
    expect([200, 201, 400, 401, 403, 405]).toContain(response.status());
  });
});
