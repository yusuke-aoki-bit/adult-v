/**
 * Cloud Run Job用のユーティリティ関数
 */

/**
 * リトライ付きで関数を実行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        onRetry?.(lastError, attempt + 1);
        console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * DB接続のリトライ付きラッパー
 */
export async function withDbRetry<T>(fn: () => Promise<T>, label: string = 'DB operation'): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    delayMs: 2000,
    backoffMultiplier: 2,
    onRetry: (error, attempt) => {
      console.warn(`[${label}] DB connection error, retry ${attempt}: ${error.message}`);
    },
  });
}

/**
 * スリープ関数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * レート制限用のスリープ（ジッター付き）
 */
export function rateLimitSleep(baseMs: number = 1000, jitterMs: number = 500): Promise<void> {
  const jitter = Math.random() * jitterMs;
  return sleep(baseMs + jitter);
}

/**
 * バッチ処理用のプログレス表示
 */
export function createProgressLogger(total: number, label: string = 'Processing') {
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  return {
    increment: (success: boolean = true) => {
      processed++;
      if (!success) errors++;
    },
    log: (interval: number = 10) => {
      if (processed % interval === 0 || processed === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processed / parseFloat(elapsed)).toFixed(1);
        const errorRate = ((errors / processed) * 100).toFixed(1);
        console.log(
          `[${label}] ${processed}/${total} (${rate}/s, errors: ${errors} (${errorRate}%), elapsed: ${elapsed}s)`,
        );
      }
    },
    summary: () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n=== ${label} Summary ===`);
      console.log(`  Total: ${processed}/${total}`);
      console.log(`  Success: ${processed - errors}`);
      console.log(`  Errors: ${errors} (${((errors / processed) * 100).toFixed(1)}%)`);
      console.log(`  Elapsed: ${elapsed}s`);
    },
  };
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(cleanup: () => Promise<void>) {
  let shuttingDown = false;

  const handler = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n${signal} received, shutting down gracefully...`);
    try {
      await cleanup();
      console.log('Cleanup completed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}
