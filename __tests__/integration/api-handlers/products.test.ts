/**
 * Products API Handler 統合テスト
 * 依存関係をモックしてAPIハンドラーの動作を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProductsHandler, type ProductsHandlerDeps, type GetProductsParams } from '@adult-v/shared/api-handlers/products';

// モックデータ
const mockProducts = [
  {
    id: '1',
    title: 'テスト作品1',
    price: 1980,
    currency: 'JPY',
    provider: 'fanza',
    providerLabel: 'FANZA',
    imageUrl: 'https://example.com/1.jpg',
    affiliateUrl: 'https://example.com/affiliate/1',
    tags: ['タグ1'],
    category: 'premium',
    isFeatured: false,
    isNew: true,
    isFuture: false,
    releaseDate: '2024-01-15',
  },
  {
    id: '2',
    title: 'テスト作品2',
    price: 2980,
    currency: 'JPY',
    provider: 'mgs',
    providerLabel: 'MGS',
    imageUrl: 'https://example.com/2.jpg',
    affiliateUrl: 'https://example.com/affiliate/2',
    tags: ['タグ2'],
    category: 'premium',
    isFeatured: true,
    isNew: false,
    isFuture: false,
    releaseDate: '2024-01-10',
  },
];

describe('Products API Handler Integration', () => {
  let mockGetProducts: ReturnType<typeof vi.fn>;
  let deps: ProductsHandlerDeps;

  beforeEach(() => {
    mockGetProducts = vi.fn().mockResolvedValue(mockProducts);
    deps = { getProducts: mockGetProducts };
  });

  describe('createProductsHandler', () => {
    it('should create a handler function', () => {
      const handler = createProductsHandler(deps);
      expect(typeof handler).toBe('function');
    });
  });

  describe('GET request handling', () => {
    it('should return products with default pagination', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products');

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toBeDefined();
      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 96, // デフォルトは96
          offset: 0,
        })
      );
    });

    it('should handle custom pagination', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?offset=20&limit=24');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 24,
          offset: 20,
        })
      );
    });

    it('should handle IDs parameter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?ids=1,2,3');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: [1, 2, 3],
        })
      );
    });

    it('should handle provider filter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?provider=fanza');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'fanza',
        })
      );
    });

    it('should handle includeAsp filter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?includeAsp=fanza,mgs');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: ['fanza', 'mgs'],
        })
      );
    });

    it('should handle excludeAsp filter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?excludeAsp=duga');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeProviders: ['duga'],
        })
      );
    });

    it('should handle actressId filter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?actressId=123');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          actressId: '123',
        })
      );
    });

    it('should handle boolean filters', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?isFeatured=true&isNew=true&hasVideo=true');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          isFeatured: true,
          isNew: true,
          hasVideo: true,
        })
      );
    });

    it('should handle sort parameter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?sort=priceAsc');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'priceAsc',
        })
      );
    });

    it('should ignore invalid sort options', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?sort=invalidSort');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: undefined,
        })
      );
    });

    it('should handle priceRange filter (range format)', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?priceRange=500-2000');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 500,
          maxPrice: 2000,
        })
      );
    });

    it('should handle priceRange filter (single value)', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?priceRange=3000');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 3000,
        })
      );
    });

    it('should handle search query parameter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?query=テスト');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'テスト',
        })
      );
    });

    it('should handle category filter', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?category=premium');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'premium',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should return 400 for limit out of range (too small)', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?limit=5');

      const response = await handler(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for limit out of range (too large)', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?limit=1000');

      const response = await handler(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for negative offset', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?offset=-1');

      const response = await handler(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid limit (NaN)', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?limit=abc');

      const response = await handler(request);

      expect(response.status).toBe(400);
    });

    it('should handle database errors gracefully', async () => {
      mockGetProducts.mockRejectedValue(new Error('Database connection failed'));
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products');

      const response = await handler(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Cache headers', () => {
    it('should set cache headers on successful response', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products');

      const response = await handler(request);

      expect(response.headers.get('Cache-Control')).toBeTruthy();
    });

    it('should set 5min cache for general list', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products');

      const response = await handler(request);

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    });

    it('should set 1hour cache for ID-based requests', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?ids=1,2,3');

      const response = await handler(request);

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });

    it('should set 1hour cache for actressId requests', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?actressId=123');

      const response = await handler(request);

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });

    it('should set 1min cache for search query requests', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products?query=test');

      const response = await handler(request);

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    });
  });

  describe('Options: adjustLimitOffsetForIds', () => {
    it('should adjust limit/offset when IDs provided and option enabled', async () => {
      const handler = createProductsHandler(deps, { adjustLimitOffsetForIds: true });
      const request = new Request('http://localhost/api/products?ids=1,2,3&offset=20&limit=24');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: [1, 2, 3],
          limit: 3,  // adjusted to ids.length
          offset: 0, // adjusted to 0
        })
      );
    });

    it('should not adjust when option disabled', async () => {
      const handler = createProductsHandler(deps, { adjustLimitOffsetForIds: false });
      const request = new Request('http://localhost/api/products?ids=1,2,3&offset=24&limit=24');

      await handler(request);

      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: [1, 2, 3],
          limit: 24,
          offset: 24,
        })
      );
    });
  });

  describe('Response structure', () => {
    it('should return correct response structure', async () => {
      const handler = createProductsHandler(deps);
      const request = new Request('http://localhost/api/products');

      const response = await handler(request);
      const data = await response.json();

      expect(data).toHaveProperty('products');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
      expect(Array.isArray(data.products)).toBe(true);
    });
  });
});
