/**
 * Recommendations API Handlers 統合テスト
 * recommendations と recommendations-from-history ハンドラーの動作を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRecommendationsHandler,
  type RecommendationsHandlerDeps,
} from '@adult-v/shared/api-handlers/recommendations';
import {
  createRecommendationsFromHistoryHandler,
  type RecommendationsFromHistoryHandlerDeps,
} from '@adult-v/shared/api-handlers/recommendations-from-history';

// =========================================================
// Recommendations (favorites-based)
// =========================================================

const mockRecommendations = [
  { id: 1, title: 'おすすめ作品1', imageUrl: 'https://example.com/1.jpg' },
  { id: 2, title: 'おすすめ作品2', imageUrl: 'https://example.com/2.jpg' },
  { id: 3, title: 'おすすめ作品3', imageUrl: 'https://example.com/3.jpg' },
];

describe('Recommendations API Handler Integration', () => {
  let mockGetRecommendations: ReturnType<typeof vi.fn>;
  let deps: RecommendationsHandlerDeps;

  beforeEach(() => {
    mockGetRecommendations = vi.fn().mockResolvedValue(mockRecommendations);
    deps = {
      getRecommendationsFromFavorites: mockGetRecommendations,
    };
  });

  it('should create a handler function', () => {
    const handler = createRecommendationsHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return empty recommendations when productIds is empty', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [] }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toEqual([]);
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it('should return empty recommendations when productIds is not an array', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: 'not-an-array' }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toEqual([]);
  });

  it('should return recommendations for valid product IDs', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [1, 2, 3], limit: 10 }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toEqual(mockRecommendations);
    expect(data.basedOn).toBe(3);
    expect(mockGetRecommendations).toHaveBeenCalledWith([1, 2, 3], 10);
  });

  it('should convert string IDs to numbers', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ['1', '2', '3'] }),
    });

    await handler(request as any);

    expect(mockGetRecommendations).toHaveBeenCalledWith([1, 2, 3], 12);
  });

  it('should filter out NaN IDs and return empty when all are invalid', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ['invalid', 'abc', 'xyz'] }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(data.recommendations).toEqual([]);
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it('should use default limit of 12 when not specified', async () => {
    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [1] }),
    });

    await handler(request as any);

    expect(mockGetRecommendations).toHaveBeenCalledWith([1], 12);
  });

  it('should handle database errors gracefully', async () => {
    mockGetRecommendations.mockRejectedValue(new Error('DB Error'));

    const handler = createRecommendationsHandler(deps);
    const request = new Request('http://localhost/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [1, 2] }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

// =========================================================
// Recommendations from History
// =========================================================

function createHistoryDbMock() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.selectDistinct = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue([]);

  return chain;
}

describe('Recommendations from History API Handler Integration', () => {
  let mockDb: ReturnType<typeof createHistoryDbMock>;
  let mockAnalyze: ReturnType<typeof vi.fn>;
  let deps: RecommendationsFromHistoryHandlerDeps;

  beforeEach(() => {
    mockDb = createHistoryDbMock();
    mockAnalyze = vi.fn().mockResolvedValue({
      personalizedMessage: 'あなたにおすすめです',
      insights: [],
    });

    deps = {
      getDb: () => mockDb,
      products: {
        id: 'products.id',
        title: 'products.title',
        normalizedProductId: 'products.normalizedProductId',
        defaultThumbnailUrl: 'products.defaultThumbnailUrl',
        releaseDate: 'products.releaseDate',
        duration: 'products.duration',
      },
      productPerformers: { productId: 'productPerformers.productId', performerId: 'productPerformers.performerId' },
      productTags: { productId: 'productTags.productId', tagId: 'productTags.tagId' },
      performers: { id: 'performers.id', name: 'performers.name', profileImageUrl: 'performers.profileImageUrl' },
      tags: { id: 'tags.id', name: 'tags.name', category: 'tags.category' },
      eq: vi.fn().mockReturnValue('eq_condition'),
      inArray: vi.fn().mockReturnValue('inArray_condition'),
      sql: Object.assign(vi.fn().mockReturnValue('sql_expr'), {
        join: vi.fn().mockReturnValue('sql_join'),
      }),
      desc: vi.fn().mockReturnValue('desc_order'),
      and: vi.fn().mockReturnValue('and_condition'),
      analyzeViewingHistory: mockAnalyze,
    };
  });

  it('should create a handler function', () => {
    const handler = createRecommendationsFromHistoryHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return empty results when history is empty', async () => {
    const handler = createRecommendationsFromHistoryHandler(deps);
    const request = new Request('http://localhost/api/recommendations/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: [] }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.recommendations).toEqual([]);
    expect(data.message).toBe('閲覧履歴がありません');
  });

  it('should return empty results when history is not provided', async () => {
    const handler = createRecommendationsFromHistoryHandler(deps);
    const request = new Request('http://localhost/api/recommendations/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.recommendations).toEqual([]);
  });

  it('should return empty results when all IDs are invalid', async () => {
    const handler = createRecommendationsFromHistoryHandler(deps);
    const request = new Request('http://localhost/api/recommendations/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: [{ id: 'abc', title: 'Invalid' }] }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.recommendations).toEqual([]);
    expect(data.message).toBe('有効な履歴がありません');
  });

  it('should process valid history and return recommendations structure', async () => {
    // The Promise.all chains end with .where() which must be thenable.
    // We create a chain where .where() resolves to an empty array.
    const thenableChain: Record<string, any> = {};
    thenableChain.select = vi.fn().mockReturnValue(thenableChain);
    thenableChain.from = vi.fn().mockReturnValue(thenableChain);
    thenableChain.innerJoin = vi.fn().mockReturnValue(thenableChain);
    thenableChain.leftJoin = vi.fn().mockReturnValue(thenableChain);
    thenableChain.where = vi.fn().mockResolvedValue([]); // terminal: resolves to []
    thenableChain.groupBy = vi.fn().mockReturnValue(thenableChain);
    thenableChain.orderBy = vi.fn().mockReturnValue(thenableChain);
    thenableChain.limit = vi.fn().mockResolvedValue([]);

    deps.getDb = () => thenableChain;

    const handler = createRecommendationsFromHistoryHandler(deps);
    const request = new Request('http://localhost/api/recommendations/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [
          { id: '1', title: 'テスト作品1' },
          { id: '2', title: 'テスト作品2' },
        ],
        limit: 6,
      }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.recommendations).toBeDefined();
    expect(data.userProfile).toBeDefined();
    expect(data.userProfile.topPerformers).toBeDefined();
    expect(data.userProfile.topGenres).toBeDefined();
  });

  it('should handle errors gracefully and return fallback', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('DB Error');
    });

    const handler = createRecommendationsFromHistoryHandler(deps);
    const request = new Request('http://localhost/api/recommendations/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [{ id: '1', title: 'テスト作品' }],
      }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.fallback).toBe(true);
    expect(data.recommendations).toEqual([]);
    expect(data.message).toBe('おすすめの取得に失敗しました');
  });
});
