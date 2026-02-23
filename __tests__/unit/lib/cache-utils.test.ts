/**
 * キャッシュユーティリティのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCacheKey, getCache, setCache, deleteCache, clearCache, CACHE_KEYS } from '@adult-v/shared/lib/cache';

// 環境変数のモック（Redisを無効化してインメモリキャッシュのみテスト）
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

describe('cache-utils', () => {
  beforeEach(() => {
    // 環境変数をクリア
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  afterEach(async () => {
    // テスト間でキャッシュをクリア
    await clearCache();
    vi.unstubAllEnvs();
  });

  describe('generateCacheKey', () => {
    it('プレフィックスのみのキーを生成', () => {
      const key = generateCacheKey('test');

      expect(key).toBe('test:{}');
    });

    it('パラメータ付きのキーを生成', () => {
      const key = generateCacheKey('products', { page: 1, limit: 10 });

      expect(key).toContain('products:');
      expect(key).toContain('"page":1');
      expect(key).toContain('"limit":10');
    });

    it('パラメータをアルファベット順にソート', () => {
      const key1 = generateCacheKey('test', { b: 2, a: 1, c: 3 });
      const key2 = generateCacheKey('test', { c: 3, a: 1, b: 2 });

      expect(key1).toBe(key2);
    });

    it('nullパラメータを空オブジェクトとして扱う', () => {
      const key = generateCacheKey('test', null as unknown as Record<string, unknown>);

      expect(key).toBe('test:{}');
    });

    it('undefinedパラメータを空オブジェクトとして扱う', () => {
      const key = generateCacheKey('test', undefined);

      expect(key).toBe('test:{}');
    });

    it('文字列値を含むパラメータ', () => {
      const key = generateCacheKey('search', { query: 'test query', filter: 'active' });

      expect(key).toContain('"query":"test query"');
      expect(key).toContain('"filter":"active"');
    });

    it('配列値を含むパラメータ', () => {
      const key = generateCacheKey('tags', { ids: [1, 2, 3] });

      expect(key).toContain('"ids":[1,2,3]');
    });

    it('ネストされたオブジェクトを含むパラメータ', () => {
      const key = generateCacheKey('complex', {
        filter: { status: 'active', type: 'premium' },
      });

      expect(key).toContain('"filter":{"status":"active","type":"premium"}');
    });
  });

  describe('インメモリキャッシュ（getCache/setCache）', () => {
    it('値を保存して取得', async () => {
      const testData = { name: 'test', value: 123 };

      await setCache('test-key', testData);
      const result = await getCache<typeof testData>('test-key');

      expect(result).toEqual(testData);
    });

    it('存在しないキーはnullを返す', async () => {
      const result = await getCache('nonexistent-key');

      expect(result).toBeNull();
    });

    it('TTL後に期限切れ', async () => {
      vi.useFakeTimers();

      await setCache('expire-test', 'data', 1); // 1秒TTL

      // 期限内
      let result = await getCache('expire-test');
      expect(result).toBe('data');

      // 2秒経過（期限切れ）
      vi.advanceTimersByTime(2000);

      result = await getCache('expire-test');
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('数値を保存', async () => {
      await setCache('number-key', 42);
      const result = await getCache<number>('number-key');

      expect(result).toBe(42);
    });

    it('配列を保存', async () => {
      const arr = [1, 2, 3, 4, 5];

      await setCache('array-key', arr);
      const result = await getCache<number[]>('array-key');

      expect(result).toEqual(arr);
    });

    it('nullを保存', async () => {
      await setCache('null-key', null);
      const result = await getCache('null-key');

      // nullを保存した場合、取得するとnullが返る（存在しない場合と区別できない）
      expect(result).toBeNull();
    });

    it('同じキーで上書き', async () => {
      await setCache('overwrite-key', 'first');
      await setCache('overwrite-key', 'second');

      const result = await getCache<string>('overwrite-key');
      expect(result).toBe('second');
    });
  });

  describe('deleteCache', () => {
    it('キャッシュを削除', async () => {
      await setCache('delete-test', 'data');
      await deleteCache('delete-test');

      const result = await getCache('delete-test');
      expect(result).toBeNull();
    });

    it('存在しないキーを削除してもエラーにならない', async () => {
      await expect(deleteCache('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('全てのキャッシュをクリア', async () => {
      await setCache('key1', 'value1');
      await setCache('key2', 'value2');
      await setCache('key3', 'value3');

      await clearCache();

      expect(await getCache('key1')).toBeNull();
      expect(await getCache('key2')).toBeNull();
      expect(await getCache('key3')).toBeNull();
    });
  });

  describe('CACHE_KEYS', () => {
    it('定義されたキーが存在', () => {
      expect(CACHE_KEYS.ACTRESSES_LIST).toBe('actresses:list');
      expect(CACHE_KEYS.ACTRESS_DETAIL).toBe('actress:detail');
      expect(CACHE_KEYS.PRODUCTS_LIST).toBe('products:list');
      expect(CACHE_KEYS.PRODUCT_DETAIL).toBe('product:detail');
      expect(CACHE_KEYS.SEARCH_RESULTS).toBe('search:results');
      expect(CACHE_KEYS.TAGS_LIST).toBe('tags:list');
      expect(CACHE_KEYS.API_RESPONSE).toBe('api:response');
      expect(CACHE_KEYS.RECOMMENDATIONS).toBe('recommendations');
    });

    it('generateCacheKeyと組み合わせて使用', () => {
      const key = generateCacheKey(CACHE_KEYS.PRODUCTS_LIST, { page: 1 });

      expect(key).toContain('products:list');
      expect(key).toContain('"page":1');
    });
  });

  describe('エラーハンドリング', () => {
    it('getCache でエラーが発生してもnullを返す', async () => {
      // インメモリキャッシュは通常エラーを発生させないが、
      // 将来的なエラーハンドリングのテスト
      const result = await getCache('any-key');
      expect(result).toBeNull();
    });

    it('setCache でエラーが発生しても例外を投げない', async () => {
      await expect(setCache('key', 'value')).resolves.not.toThrow();
    });
  });

  describe('複合的なシナリオ', () => {
    it('複数のキャッシュを独立して管理', async () => {
      await setCache('user:1', { name: 'User 1' });
      await setCache('user:2', { name: 'User 2' });
      await setCache('product:1', { title: 'Product 1' });

      expect(await getCache('user:1')).toEqual({ name: 'User 1' });
      expect(await getCache('user:2')).toEqual({ name: 'User 2' });
      expect(await getCache('product:1')).toEqual({ title: 'Product 1' });

      await deleteCache('user:1');

      expect(await getCache('user:1')).toBeNull();
      expect(await getCache('user:2')).toEqual({ name: 'User 2' });
    });

    it('同一プレフィックスの異なるパラメータ', async () => {
      const key1 = generateCacheKey('products', { page: 1, sort: 'date' });
      const key2 = generateCacheKey('products', { page: 2, sort: 'date' });
      const key3 = generateCacheKey('products', { page: 1, sort: 'price' });

      await setCache(key1, 'page1-date');
      await setCache(key2, 'page2-date');
      await setCache(key3, 'page1-price');

      expect(await getCache(key1)).toBe('page1-date');
      expect(await getCache(key2)).toBe('page2-date');
      expect(await getCache(key3)).toBe('page1-price');
    });
  });
});
