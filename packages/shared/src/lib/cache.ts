/**
 * Redisキャッシュユーティリティ
 * Upstash Redisを使用（環境変数が設定されている場合）
 * フォールバックとしてインメモリキャッシュを使用
 */

// Upstash Redis クライアント型定義（動的インポート用）
interface RedisClientType {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: string | number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
}

// キャッシュTTL設定（秒）
const CACHE_TTL = {
  /** 短期: 頻繁に更新されるデータ（検索結果、レコメンド） */
  SHORT: 60 * 5, // 5分
  /** 中期: 日次で更新されるデータ（一覧、API応答） */
  MEDIUM: 60 * 60, // 1時間（ISR revalidate=300sとの整合性、DB負荷削減）
  /** 長期: ほぼ静的なデータ（詳細ページ、タグ） */
  LONG: 60 * 60 * 2, // 2時間
  /** 超長期: 滅多に変わらないデータ */
  VERY_LONG: 60 * 60 * 12, // 12時間
} as const;

// デフォルトTTL
const DEFAULT_TTL = CACHE_TTL.SHORT;

// キャッシュキーのプレフィックス
const CACHE_KEYS = {
  ACTRESSES_LIST: 'actresses:list',
  ACTRESS_DETAIL: 'actress:detail',
  PRODUCTS_LIST: 'products:list',
  PRODUCT_DETAIL: 'product:detail',
  SEARCH_RESULTS: 'search:results',
  TAGS_LIST: 'tags:list',
  API_RESPONSE: 'api:response',
  RECOMMENDATIONS: 'recommendations',
} as const;

// Upstash Redis クライアント（動的インポートで遅延読み込み）
let redisClient: RedisClientType | null = null;
let redisInitialized = false;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];

  if (url && token) {
    try {
      // 動的インポートでビルド時の問題を回避
      const { Redis } = await import('@upstash/redis');
      redisClient = new Redis({ url, token }) as unknown as RedisClientType;
      // 開発環境でのみログ出力
      if (process.env['NODE_ENV'] === 'development') {
        console.log('[cache] Upstash Redis client initialized');
      }
      return redisClient;
    } catch (error) {
      // 初期化エラーは警告として出力（本番でも把握が必要）
      if (process.env['NODE_ENV'] === 'development') {
        console.warn('[cache] Failed to initialize Upstash Redis:', error);
      }
      return null;
    }
  }

  return null;
}

// Redisが利用可能かどうか（非同期）
export async function isRedisAvailable(): Promise<boolean> {
  const client = await getRedisClient();
  return client !== null;
}

/**
 * キャッシュキーを生成
 */
export function generateCacheKey(prefix: string, params?: Record<string, unknown>): string {
  // paramsがnullまたはundefinedの場合は空オブジェクトとして扱う
  const safeParams = params || {};

  const sortedParams = Object.keys(safeParams)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = safeParams[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

/**
 * シンプルなインメモリキャッシュ（Redisが利用できない場合のフォールバック）
 */
class InMemoryCache {
  private cache = new Map<string, { data: unknown; expires: number }>();
  private static readonly MAX_ENTRIES = 500;

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache['delete'](key);
      return null;
    }

    // LRU: アクセスされたエントリを末尾に移動
    this.cache['delete'](key);
    this.cache.set(key, item);

    return item.data as T;
  }

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    // 既存キーの場合は削除してから再挿入（末尾に移動）
    if (this.cache.has(key)) {
      this.cache['delete'](key);
    }

    // 上限超過時は最も古いエントリ（先頭）を削除
    while (this.cache.size >= InMemoryCache.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache['delete'](oldestKey);
      else break;
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): void {
    this.cache['delete'](key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // 定期的に期限切れのキャッシュを削除
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache['delete'](key);
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
 * Upstash Redisが利用可能な場合はRedisから、そうでない場合はインメモリから取得
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();

    if (redis) {
      // Upstash Redisから取得
      const data = await redis.get<T>(key);
      return data;
    }

    // インメモリキャッシュから取得
    return memoryCache.get<T>(key);
  } catch {
    // Redisエラー時はインメモリにフォールバック
    return memoryCache.get<T>(key);
  }
}

/**
 * キャッシュに保存
 * Upstash Redisが利用可能な場合はRedisに、そうでない場合はインメモリに保存
 */
export async function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    const redis = await getRedisClient();

    if (redis) {
      // Upstash Redisに保存（EXオプションでTTL設定）
      await redis.set(key, data, { ex: ttl });
      return;
    }

    // インメモリキャッシュに保存
    memoryCache.set(key, data, ttl);
  } catch {
    // Redisエラー時はインメモリにフォールバック
    memoryCache.set(key, data, ttl);
  }
}

/**
 * キャッシュを削除
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = await getRedisClient();

    if (redis) {
      await redis.del(key);
      return;
    }

    memoryCache.delete(key);
  } catch {
    memoryCache.delete(key);
  }
}

/**
 * パターンに一致するキャッシュを削除
 * Upstash RedisではSCANを使用してパターンマッチ
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = await getRedisClient();

    if (redis) {
      // Upstash RedisでSCANを使用してキーを取得して削除
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = String(result[0]);
        const keys = result[1];
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      return;
    }

    // インメモリキャッシュの場合は全削除
    memoryCache.clear();
  } catch {
    memoryCache.clear();
  }
}

/**
 * キャッシュをクリア
 */
export async function clearCache(): Promise<void> {
  try {
    memoryCache.clear();
  } catch {
    // キャッシュクリアエラーは無視
  }
}

export { CACHE_KEYS, CACHE_TTL };
