/**
 * Actresses API Handler 統合テスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActressesHandler, type ActressesHandlerDeps } from '@adult-v/shared/api-handlers/actresses';

// モックデータ
const mockActresses = [
  {
    id: '1',
    name: 'テスト女優1',
    catchcopy: '',
    heroImage: 'https://example.com/hero1.jpg',
    thumbnail: 'https://example.com/thumb1.jpg',
    primaryGenres: ['premium'],
    services: ['fanza', 'mgs'],
    metrics: { releaseCount: 100, trendingScore: 80, fanScore: 90 },
    highlightWorks: [],
    tags: [],
  },
  {
    id: '2',
    name: 'テスト女優2',
    catchcopy: '',
    heroImage: 'https://example.com/hero2.jpg',
    thumbnail: 'https://example.com/thumb2.jpg',
    primaryGenres: ['premium'],
    services: ['fanza'],
    metrics: { releaseCount: 50, trendingScore: 60, fanScore: 70 },
    highlightWorks: [],
    tags: [],
  },
];

const mockFeaturedActresses = [mockActresses[0]];

describe('Actresses API Handler Integration', () => {
  let mockGetActresses: ReturnType<typeof vi.fn>;
  let mockGetFeaturedActresses: ReturnType<typeof vi.fn>;
  let deps: ActressesHandlerDeps;

  beforeEach(() => {
    mockGetActresses = vi.fn().mockResolvedValue(mockActresses);
    mockGetFeaturedActresses = vi.fn().mockResolvedValue(mockFeaturedActresses);
    deps = {
      getActresses: mockGetActresses,
      getFeaturedActresses: mockGetFeaturedActresses,
    };
  });

  describe('createActressesHandler', () => {
    it('should create a handler function', () => {
      const handler = createActressesHandler(deps);
      expect(typeof handler).toBe('function');
    });
  });

  describe('GET request handling', () => {
    it('should return actresses with default pagination', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses');

      const response = await handler(request);
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.actresses).toBeDefined();
      expect(data.total).toBe(mockActresses.length);
      expect(mockGetActresses).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 48, // デフォルト
          offset: 0,
        }),
      );
    });

    it('should handle custom pagination', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?offset=20&limit=24');

      await handler(request);

      expect(mockGetActresses).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 24,
          offset: 20,
        }),
      );
    });

    it('should handle search query', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?query=テスト');

      await handler(request);

      expect(mockGetActresses).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'テスト',
        }),
      );
    });

    it('should handle IDs parameter', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?ids=1,2,3');

      await handler(request);

      expect(mockGetActresses).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: [1, 2, 3],
          limit: 3, // IDs指定時はlimit=ids.length
          offset: 0, // IDs指定時はoffset=0
        }),
      );
    });
  });

  describe('Featured actresses', () => {
    it('should return featured actresses when featured=true', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?featured=true');

      const response = await handler(request);
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(mockGetFeaturedActresses).toHaveBeenCalledWith(3); // デフォルトlimit
      expect(data.actresses).toBeDefined();
    });

    it('should handle custom limit for featured actresses', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?featured=true&limit=5');

      await handler(request);

      expect(mockGetFeaturedActresses).toHaveBeenCalledWith(5);
    });

    it('should cap featured limit at 20', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?featured=true&limit=50');

      await handler(request);

      expect(mockGetFeaturedActresses).toHaveBeenCalledWith(20);
    });
  });

  describe('Response structure', () => {
    it('should include pagination metadata for list request', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?offset=20&limit=24');

      const response = await handler(request);
      const data = await response!.json();

      expect(data).toHaveProperty('actresses');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
    });

    it('should only include actresses and total for featured request', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?featured=true');

      const response = await handler(request);
      const data = await response!.json();

      expect(data).toHaveProperty('actresses');
      expect(data).toHaveProperty('total');
      // featured=trueの場合、limit/offsetは含まれない
      expect(data.limit).toBeUndefined();
      expect(data.offset).toBeUndefined();
    });
  });

  describe('Cache headers', () => {
    it('should set 1hour cache for normal list', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });

    it('should set 5min cache for search results', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?query=test');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toContain('s-maxage=300');
    });

    it('should set 1hour cache for featured actresses', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?featured=true');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });

    it('should set 1hour cache for IDs-based requests', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?ids=1,2,3');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockGetActresses.mockRejectedValue(new Error('DB Error'));
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses');

      const response = await handler(request);

      expect(response!.status).toBe(500);
      const data = await response!.json();
      expect(data.error).toBe('Failed to fetch actresses');
    });

    it('should return 400 for invalid limit (out of range)', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?limit=5');

      const response = await handler(request);

      expect(response!.status).toBe(400);
    });

    it('should return 400 for invalid limit (too large)', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?limit=1000');

      const response = await handler(request);

      expect(response!.status).toBe(400);
    });

    it('should return 400 for negative offset', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?offset=-1');

      const response = await handler(request);

      expect(response!.status).toBe(400);
    });

    it('should return 400 for NaN limit', async () => {
      const handler = createActressesHandler(deps);
      const request = new Request('http://localhost/api/actresses?limit=abc');

      const response = await handler(request);

      expect(response!.status).toBe(400);
    });
  });
});
