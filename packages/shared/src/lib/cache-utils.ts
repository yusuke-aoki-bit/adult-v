/**
 * キャッシュユーティリティ
 * Next.js unstable_cacheとメモリキャッシュの共通実装
 */

// デフォルトキャッシュ設定
export const CACHE_CONFIG = {
  /** デフォルトの再検証時間（秒） */
  DEFAULT_REVALIDATE_SECONDS: 300, // 5分
  /** メモリキャッシュのTTL（ミリ秒） */
  MEMORY_TTL_MS: 5 * 60 * 1000, // 5分
  /** メモリキャッシュの最大エントリ数 */
  MEMORY_MAX_ENTRIES: 100,
  /** 短期キャッシュ（秒） */
  SHORT_REVALIDATE: 60, // 1分
  /** 中期キャッシュ（秒） */
  MEDIUM_REVALIDATE: 300, // 5分
  /** 長期キャッシュ（秒） */
  LONG_REVALIDATE: 3600, // 1時間
} as const;

/**
 * メモリキャッシュエントリ
 */
interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * シンプルなメモリキャッシュ
 * サーバーサイドでのリクエスト間キャッシュ用
 */
class MemoryCache {
  private cache = new Map<string, MemoryCacheEntry<unknown>>();
  private maxEntries: number;

  constructor(maxEntries: number = CACHE_CONFIG.MEMORY_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /**
   * キャッシュから値を取得
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp >= entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * キャッシュに値を設定
   */
  set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.MEMORY_TTL_MS): void {
    // サイズ制限チェック
    if (this.cache.size >= this.maxEntries) {
      // 最も古いエントリを削除
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 期限切れエントリを削除
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * キャッシュサイズを取得
   */
  get size(): number {
    return this.cache.size;
  }
}

// シングルトンインスタンス
let globalMemoryCache: MemoryCache | null = null;

/**
 * グローバルメモリキャッシュを取得
 */
export function getMemoryCache(): MemoryCache {
  if (!globalMemoryCache) {
    globalMemoryCache = new MemoryCache();
  }
  return globalMemoryCache;
}

/**
 * キャッシュキー生成ヘルパー
 */
export function createCacheKey(prefix: string, ...parts: (string | number | boolean | null | undefined)[]): string {
  const validParts = parts.filter((p) => p !== null && p !== undefined);
  return `${prefix}:${validParts.join(':')}`;
}

/**
 * unstable_cache用のキーパーツ生成
 */
export function createCacheKeyParts(functionName: string, siteMode?: string): string[] {
  const parts = [functionName];
  if (siteMode) {
    parts.push(siteMode);
  }
  return parts;
}

/**
 * キャッシュタグ生成
 */
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  ACTRESSES: 'actresses',
  SALES: 'sales',
  RECOMMENDATIONS: 'recommendations',
  TAGS: 'tags',
} as const;

/**
 * キャッシュ付き関数を作成するファクトリー
 * （unstable_cacheのラッパー用の型定義）
 */
export interface CachedFunctionOptions {
  keyParts: string[];
  tags?: string[];
  revalidate?: number;
}

/**
 * メモリキャッシュ付きの関数を作成
 */
export function withMemoryCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  ttl: number = CACHE_CONFIG.MEMORY_TTL_MS
): (...args: TArgs) => Promise<TResult> {
  const cache = getMemoryCache();

  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args);
    const cached = cache.get<TResult>(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(key, result, ttl);
    return result;
  };
}
