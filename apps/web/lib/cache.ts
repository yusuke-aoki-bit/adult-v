/**
 * Redisキャッシュユーティリティ
 */

// キャッシュTTL設定
const CACHE_TTL = 60 * 5; // 5分

// キャッシュキーのプレフィックス
const CACHE_KEYS = {
  ACTRESSES_LIST: 'actresses:list',
  ACTRESS_DETAIL: 'actress:detail',
  PRODUCTS_LIST: 'products:list',
  PRODUCT_DETAIL: 'product:detail',
  SEARCH_RESULTS: 'search:results',
  TAGS_LIST: 'tags:list',
} as const;

/**
 * キャッシュキーを生成
 */
export function generateCacheKey(
  prefix: string,
  params?: Record<string, any>
): string {
  // paramsがnullまたはundefinedの場合は空オブジェクトとして扱う
  const safeParams = params || {};

  const sortedParams = Object.keys(safeParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = safeParams[key];
      return acc;
    }, {} as Record<string, any>);

  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

/**
 * シンプルなインメモリキャッシュ（Redisが利用できない場合のフォールバック）
 */
class InMemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // 定期的に期限切れのキャッシュを削除
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// インメモリキャッシュのインスタンス
const memoryCache = new InMemoryCache();

// 定期的にクリーンアップ（5分ごと）
if (typeof setInterval !== 'undefined') {
  setInterval(() => memoryCache.cleanup(), 5 * 60 * 1000);
}

/**
 * キャッシュから取得
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    // インメモリキャッシュから取得
    return memoryCache.get<T>(key);
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * キャッシュに保存
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    memoryCache.set(key, data, ttl);
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * キャッシュを削除
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    memoryCache.delete(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * パターンに一致するキャッシュを削除
 */
export async function deleteCachePattern(_pattern: string): Promise<void> {
  try {
    // インメモリキャッシュの場合は全削除
    memoryCache.clear();
  } catch (error) {
    console.error('Cache delete pattern error:', error);
  }
}

/**
 * キャッシュをクリア
 */
export async function clearCache(): Promise<void> {
  try {
    memoryCache.clear();
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

export { CACHE_KEYS };
