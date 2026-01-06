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

  constructor(private options: RateLimiterOptions) {
    this.options = {
      maxConcurrent: 1,
      addJitter: false,
      jitterRange: 500,
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
   * リクエスト完了を通知
   */
  done(): void {
    this.activeRequests--;

    // キューに待機中のリクエストがあれば解放
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  /**
   * リクエストをラップして実行
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.wait();
    try {
      return await fn();
    } finally {
      this.done();
    }
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
 */
export const SITE_RATE_LIMITS: Record<string, RateLimiterOptions> = {
  // DTI系サイト（比較的寛容）
  dti: { minDelayMs: 500, addJitter: true, jitterRange: 300 },

  // DUGA（API）
  duga: { minDelayMs: 1000, addJitter: false },

  // MGS（比較的厳しい）
  mgs: { minDelayMs: 2000, addJitter: true, jitterRange: 500 },

  // FC2（厳しい）
  fc2: { minDelayMs: 3000, addJitter: true, jitterRange: 1000 },

  // Japanska
  japanska: { minDelayMs: 1500, addJitter: true, jitterRange: 500 },

  // Sokmil
  sokmil: { minDelayMs: 1000, addJitter: true, jitterRange: 300 },

  // デフォルト
  default: { minDelayMs: 1000, addJitter: true, jitterRange: 500 },
};

/**
 * サイト名からレート制限設定を取得
 */
export function getRateLimiterForSite(siteName: string): RateLimiter {
  const normalized = siteName.toLowerCase();
  const options = SITE_RATE_LIMITS[normalized] || SITE_RATE_LIMITS['default'];
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
