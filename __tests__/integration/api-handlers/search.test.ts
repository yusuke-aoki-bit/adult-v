/**
 * Search API Handlers 統合テスト
 * search-autocomplete と product-search ハンドラーの動作を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSearchAutocompleteHandler,
  type SearchAutocompleteHandlerDeps,
} from '@adult-v/shared/api-handlers/search-autocomplete';
import { createProductSearchHandler, type ProductSearchHandlerDeps } from '@adult-v/shared/api-handlers/product-search';

// =========================================================
// Search Autocomplete
// =========================================================

// チェーン可能なクエリビルダーモックを作成するヘルパー
function createChainMock(resolvedValue: unknown[] = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

describe('Search Autocomplete API Handler Integration', () => {
  let mockDb: ReturnType<typeof createChainMock>;
  let deps: SearchAutocompleteHandlerDeps;

  beforeEach(() => {
    // Each call to limit() resolves to a different result set
    // Order: productIdMatches, actressMatches, tagMatches, titleMatches
    const limitResults = [
      // 1. productIdMatches
      [
        {
          id: 1,
          title: 'テスト作品',
          normalizedProductId: 'ABC-001',
          originalProductId: 'ABC-001',
          thumbnail: 'https://example.com/1.jpg',
        },
      ],
      // 2. actressMatches
      [{ id: 10, name: 'テスト女優', image: 'https://example.com/actress.jpg', productCount: 50 }],
      // 3. tagMatches
      [{ id: 100, name: 'テストタグ', category: 'ジャンル' }],
      // 4. titleMatches
      [{ id: 2, title: 'タイトルで一致する作品', thumbnail: 'https://example.com/2.jpg' }],
    ];

    let callIndex = 0;
    mockDb = createChainMock();
    mockDb.limit = vi.fn().mockImplementation(() => {
      const result = limitResults[callIndex] || [];
      callIndex++;
      return Promise.resolve(result);
    });

    deps = {
      getDb: () => mockDb,
      products: {
        id: 'products.id',
        title: 'products.title',
        normalizedProductId: 'products.normalizedProductId',
        defaultThumbnailUrl: 'products.defaultThumbnailUrl',
      },
      performers: { id: 'performers.id', name: 'performers.name', profileImageUrl: 'performers.profileImageUrl' },
      tags: { id: 'tags.id', name: 'tags.name', category: 'tags.category' },
      productSources: { productId: 'productSources.productId', originalProductId: 'productSources.originalProductId' },
    };
  });

  it('should create a handler function', () => {
    const handler = createSearchAutocompleteHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return empty results for query shorter than 2 characters', async () => {
    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete?q=a');

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toEqual([]);
  });

  it('should return empty results when query is missing', async () => {
    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete');

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toEqual([]);
  });

  it('should return combined results for valid query', async () => {
    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete?q=テスト');

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.query).toBe('テスト');
    expect(data.results.length).toBeGreaterThan(0);
    // 品番、女優、タグ、作品の4種類の結果が含まれるはず
    const types = data.results.map((r: { type: string }) => r.type);
    expect(types).toContain('product_id');
    expect(types).toContain('actress');
    expect(types).toContain('tag');
    expect(types).toContain('product');
  });

  it('should filter out invalid performer names', async () => {
    // 無効な名前を持つ女優を含むモック
    const limitResults = [
      [],
      // 2. actressMatches with invalid names
      [
        { id: 10, name: 'デ', image: null, productCount: 5 },
        { id: 11, name: '→invalid', image: null, productCount: 3 },
        { id: 12, name: '有効な女優名', image: null, productCount: 10 },
      ],
      [],
      [],
    ];
    let callIndex = 0;
    mockDb.limit = vi.fn().mockImplementation(() => {
      const result = limitResults[callIndex] || [];
      callIndex++;
      return Promise.resolve(result);
    });

    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete?q=テスト');

    const response = await handler(request as any);
    const data = await response.json();

    const actressResults = data.results.filter((r: { type: string }) => r.type === 'actress');
    expect(actressResults).toHaveLength(1);
    expect(actressResults[0].name).toBe('有効な女優名');
  });

  it('should limit results to 10 items', async () => {
    // 大量の結果を返すモック
    const manyResults = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `作品${i}`,
      normalizedProductId: `ID-${i}`,
      originalProductId: `ID-${i}`,
      thumbnail: null,
    }));
    const manyActresses = Array.from({ length: 5 }, (_, i) => ({
      id: i + 100,
      name: `女優${i}`,
      image: null,
      productCount: i,
    }));
    const manyTags = Array.from({ length: 5 }, (_, i) => ({
      id: i + 200,
      name: `タグ${i}`,
      category: 'ジャンル',
    }));

    const limitResults = [manyResults, manyActresses, manyTags, []];
    let callIndex = 0;
    mockDb.limit = vi.fn().mockImplementation(() => {
      const result = limitResults[callIndex] || [];
      callIndex++;
      return Promise.resolve(result);
    });

    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete?q=テスト');

    const response = await handler(request as any);
    const data = await response.json();

    expect(data.results.length).toBeLessThanOrEqual(10);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.limit = vi.fn().mockRejectedValue(new Error('DB connection failed'));

    const handler = createSearchAutocompleteHandler(deps);
    const request = new Request('http://localhost/api/search/autocomplete?q=テスト');

    const response = await handler(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

// =========================================================
// Product Search
// =========================================================

const mockSearchProducts = [
  { id: 1, title: 'テスト作品1', price: 1980 },
  { id: 2, title: 'テスト作品2', price: 2980 },
];

describe('Product Search API Handler Integration', () => {
  let mockGetProducts: ReturnType<typeof vi.fn>;
  let deps: ProductSearchHandlerDeps;

  beforeEach(() => {
    mockGetProducts = vi.fn().mockResolvedValue(mockSearchProducts);
    deps = { getProducts: mockGetProducts };
  });

  it('should create a handler function', () => {
    const handler = createProductSearchHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return 400 when query is missing', async () => {
    const handler = createProductSearchHandler(deps);
    const request = new Request('http://localhost/api/search/products');

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should return 400 when query is too long', async () => {
    const handler = createProductSearchHandler(deps);
    const longQuery = 'a'.repeat(201);
    const request = new Request(`http://localhost/api/search/products?q=${longQuery}`);

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('too long');
  });

  it('should search products with valid query', async () => {
    const handler = createProductSearchHandler(deps);
    const request = new Request('http://localhost/api/search/products?q=テスト');

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toBeDefined();
    expect(data.count).toBe(2);
    expect(data.query).toBe('テスト');
    expect(mockGetProducts).toHaveBeenCalledWith(expect.objectContaining({ query: 'テスト' }));
  });

  it('should pass sortBy, tags, and filter parameters to getProducts', async () => {
    const handler = createProductSearchHandler(deps);
    const request = new Request(
      'http://localhost/api/search/products?q=テスト&sortBy=priceAsc&tags=1,2&excludeTags=3&hasVideo=true&hasImage=true&minPrice=500&maxPrice=3000&site=fanza',
    );

    await handler(request);

    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'テスト',
        sortBy: 'priceAsc',
        tags: ['1', '2'],
        excludeTags: ['3'],
        hasVideo: true,
        hasImage: true,
        minPrice: 500,
        maxPrice: 3000,
        provider: 'fanza',
      }),
    );
  });

  it('should default sortBy to releaseDateDesc for invalid sort', async () => {
    const handler = createProductSearchHandler(deps);
    const request = new Request('http://localhost/api/search/products?q=テスト&sortBy=invalidSort');

    await handler(request);

    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'releaseDateDesc',
      }),
    );
  });

  it('should sanitize limit and offset values', async () => {
    const handler = createProductSearchHandler(deps);
    const request = new Request('http://localhost/api/search/products?q=テスト&limit=999&offset=-5');

    await handler(request);

    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100, // clamped to max 100
        offset: 0, // clamped to min 0
      }),
    );
  });

  it('should return fallback response on database error', async () => {
    mockGetProducts.mockRejectedValue(new Error('DB Error'));
    const handler = createProductSearchHandler(deps);
    const request = new Request('http://localhost/api/search/products?q=テスト');

    const response = await handler(request);
    const data = await response.json();

    // Error handler returns a fallback response (not a 500 status)
    expect(data.fallback).toBe(true);
    expect(data.products).toEqual([]);
    expect(data.count).toBe(0);
  });
});
