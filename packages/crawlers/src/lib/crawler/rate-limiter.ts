/**
 * レート制限
 *
 * APIやWebサイトへのリクエスト頻度を制御
 */

export interface RateLimiterOptions {
  /** リクエスト間の最小間隔（ミリ秒） */
  minDelayMs: number;
  /** 最大同時リクエスト数 */
  maxConcurrent?: number;
  /** ランダム遅延を追加するか（ボット検出回避） */
  addJitter?: boolean;
  /** ジッター範囲（ミリ秒） */
  jitterRange?: number;
  /** 指数バックオフを有効にするか */
  enableExponentialBackoff?: boolean;
  /** バックオフの最大遅延（ミリ秒） */
  maxBackoffDelayMs?: number;
  /** バックオフの基数 */
  backoffMultiplier?: number;
}

/**
 * レート制限クラス
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ minDelayMs: 1000 });
 *
 * for (const url of urls) {
 *   await limiter.wait();
 *   const response = await fetch(url);
 * }
 * ```
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private activeRequests = 0;
  private queue: Array<() => void> = [];
  private consecutiveErrors = 0;
  private currentBackoffDelay = 0;

  constructor(private options: RateLimiterOptions) {
    this.options = {
      maxConcurrent: 1,
      addJitter: false,
      jitterRange: 500,
      enableExponentialBackoff: true,
      maxBackoffDelayMs: 60000, // 最大60秒
      backoffMultiplier: 2,
      ...options,
    };
  }

  /**
   * 次のリクエストまで待機
   */
  async wait(): Promise<void> {
    // 同時実行数制限のチェック
    if (this.options.maxConcurrent && this.activeRequests >= this.options.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    // 最小間隔のチェック
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    let delay = this.options.minDelayMs - elapsed;

    // バックオフ遅延を追加
    if (this.currentBackoffDelay > 0) {
      delay += this.currentBackoffDelay;
    }

    // ジッターを追加
    if (this.options.addJitter && this.options.jitterRange) {
      delay += Math.random() * this.options.jitterRange;
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.activeRequests++;
  }

  /**
   * リクエスト完了を通知（成功時）
   */
  done(): void {
    this.activeRequests--;

    // 成功時はバックオフをリセット
    this.consecutiveErrors = 0;
    this.currentBackoffDelay = 0;

    // キューに待機中のリクエストがあれば解放
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  /**
   * エラー発生を通知（指数バックオフを適用）
   * @param statusCode - HTTPステータスコード（429や503の場合は強いバックオフ）
   */
  onError(statusCode?: number): void {
    this.activeRequests--;

    if (this.options.enableExponentialBackoff) {
      this.consecutiveErrors++;

      // 429 (Too Many Requests) または 503 (Service Unavailable) は特に慎重に
      const isRateLimited = statusCode === 429 || statusCode === 503;
      const multiplier = isRateLimited
        ? (this.options.backoffMultiplier || 2) * 2
        : (this.options.backoffMultiplier || 2);

      // 指数バックオフ: baseDelay * multiplier^(errors-1)
      const baseDelay = this.options.minDelayMs;
      this.currentBackoffDelay = Math.min(
        baseDelay * Math.pow(multiplier, this.consecutiveErrors - 1),
        this.options.maxBackoffDelayMs || 60000
      );

      console.log(`[RateLimiter] Backoff applied: ${this.currentBackoffDelay}ms (errors: ${this.consecutiveErrors}, statusCode: ${statusCode || 'unknown'})`);
    }

    // キューに待機中のリクエストがあれば解放
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  /**
   * リクエストをラップして実行
   * @param fn - 実行する非同期関数
   * @param getStatusCode - エラー時にステータスコードを取得する関数（オプション）
   */
  async execute<T>(fn: () => Promise<T>, getStatusCode?: (error: unknown) => number | undefined): Promise<T> {
    await this.wait();
    try {
      const result = await fn();
      this.done();
      return result;
    } catch (error) {
      const statusCode = getStatusCode?.(error);
      this.onError(statusCode);
      throw error;
    }
  }

  /**
   * バックオフをリセット
   */
  resetBackoff(): void {
    this.consecutiveErrors = 0;
    this.currentBackoffDelay = 0;
  }

  /**
   * 現在のバックオフ遅延を取得
   */
  getCurrentBackoffDelay(): number {
    return this.currentBackoffDelay;
  }

  /**
   * 連続エラー数を取得
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  /**
   * 現在のアクティブリクエスト数を取得
   */
  getActiveCount(): number {
    return this.activeRequests;
  }

  /**
   * キューに待機中のリクエスト数を取得
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * サイト別のデフォルトレート制限設定
 * 指数バックオフ付きで、エラー時は自動的に遅延を増加
 */
export const SITE_RATE_LIMITS: Record<string, RateLimiterOptions> = {
  // DTI系サイト（比較的寛容）
  dti: {
    minDelayMs: 500,
    addJitter: true,
    jitterRange: 300,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 30000,
    backoffMultiplier: 2,
  },

  // DUGA（API）
  duga: {
    minDelayMs: 1000,
    addJitter: false,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 30000,
    backoffMultiplier: 2,
  },

  // MGS（比較的厳しい）
  mgs: {
    minDelayMs: 2000,
    addJitter: true,
    jitterRange: 500,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 120000, // 最大2分
    backoffMultiplier: 2,
  },

  // FC2（厳しい）
  fc2: {
    minDelayMs: 3000,
    addJitter: true,
    jitterRange: 1000,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 180000, // 最大3分
    backoffMultiplier: 2.5,
  },

  // Japanska
  japanska: {
    minDelayMs: 1500,
    addJitter: true,
    jitterRange: 500,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 60000,
    backoffMultiplier: 2,
  },

  // Sokmil
  sokmil: {
    minDelayMs: 1000,
    addJitter: true,
    jitterRange: 300,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 30000,
    backoffMultiplier: 2,
  },

  // デフォルト
  default: {
    minDelayMs: 1000,
    addJitter: true,
    jitterRange: 500,
    enableExponentialBackoff: true,
    maxBackoffDelayMs: 60000,
    backoffMultiplier: 2,
  },
};

/**
 * サイト名からレート制限設定を取得
 */
export function getRateLimiterForSite(siteName: string): RateLimiter {
  const normalized = siteName.toLowerCase();
  const options = SITE_RATE_LIMITS[normalized] || SITE_RATE_LIMITS.default;
  return new RateLimiter(options);
}

/**
 * ランダムな遅延を生成
 *
 * @param minMs - 最小遅延（ミリ秒）
 * @param maxMs - 最大遅延（ミリ秒）
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
