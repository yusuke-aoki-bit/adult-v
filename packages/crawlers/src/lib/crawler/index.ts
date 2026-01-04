/**
 * クローラー共通ユーティリティ
 *
 * リトライ、タイムアウト、レート制限などの機能を提供
 */

// リトライ
export {
  withRetry,
  fetchWithRetry,
  isRetryableError,
  isRetryableStatus,
  type RetryOptions,
} from './retry';

// タイムアウト
export {
  withTimeout,
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUTS,
} from './timeout';

// レート制限
export {
  RateLimiter,
  getRateLimiterForSite,
  randomDelay,
  SITE_RATE_LIMITS,
  type RateLimiterOptions,
} from './rate-limiter';

// AI機能
export {
  CrawlerAIHelper,
  getAIHelper,
  processProductWithAI,
  type ExtractedTags,
  type AIProcessingResult,
  type ProductAIInput,
  type CrawlerAIOptions,
} from './ai-helper';

// 重複防止
export {
  calculateHash,
  calculateJsonHash,
  checkDugaRawData,
  checkSokmilRawData,
  checkMgsRawData,
  checkRawHtmlData,
  // Legacy (DB only)
  upsertDugaRawData,
  upsertSokmilRawData,
  upsertMgsRawData,
  // Recommended (GCS + dedup)
  upsertDugaRawDataWithGcs,
  upsertSokmilRawDataWithGcs,
  upsertMgsRawDataWithGcs,
  upsertRawHtmlDataWithGcs,
  linkProductToRawData,
  markRawDataAsProcessed,
  getTableNameForSource,
  getUnprocessedCount,
  type SourceType,
  type RawDataTable,
  type RawDataCheckResult,
  type UpsertRawDataResult,
  type LinkProductResult,
} from './dedup-helper';

// 共通型定義
export {
  type BaseCrawlStats,
  type ExtendedCrawlStats,
  type IdRow,
  type ProductRow,
  type RawDataRow,
  type PerformerRow,
  type TagRow,
  type ParsedProductData as LegacyParsedProductData, // types.tsのもの（レガシー用）
  type CrawlOptions,
  type CrawlResult,
  getFirstRow,
  getRows,
} from './types';

// バッチ処理
export {
  normalizeAndValidatePerformers,
  ensurePerformers,
  linkProductToPerformers,
  processProductPerformers,
  ensureTags,
  linkProductToTags,
  saveProductImages,
  replaceProductImages,
} from './batch-helpers';

// ベースクローラー
export {
  BaseCrawler,
  generateDateRanges,
  parseCliArgs,
  printCrawlerHeader,
  runCrawler,
  type BaseCrawlerOptions,
  type CrawlerStats,
  type ParsedProductData,
  type ParsedCliArgs,
} from './base-crawler';

// パースヘルパー
export {
  extractPrice,
  extractPriceInfo,
  parsePerformerName,
  parsePerformerNames,
  normalizePerformerName,
  parseDate,
  parseDuration,
  stripHtml,
  normalizeText,
  normalizeProductId,
  resolveUrl,
  getQueryParam,
  getLastPathSegment,
  isValidImageUrl,
  isValidVideoUrl,
  isValidTitle,
  type PriceInfo,
  type ParsedPerformer,
} from './parse-helpers';

// ブラウザベースクローラー
export {
  BrowserCrawler,
  puppeteer,
  type BrowserCrawlerOptions,
  type PageContext,
} from './browser-crawler';

/**
 * フル機能のfetch（タイムアウト + リトライ + レート制限対応）
 */
import { withRetry, type RetryOptions, isRetryableError } from './retry';
import { fetchWithTimeout } from './timeout';
import { RateLimiter } from './rate-limiter';

export interface RobustFetchOptions {
  /** fetchオプション */
  init?: RequestInit;
  /** タイムアウト（ミリ秒） */
  timeoutMs?: number;
  /** リトライオプション */
  retry?: RetryOptions;
  /** レート制限インスタンス */
  rateLimiter?: RateLimiter;
}

/**
 * 堅牢なfetch
 *
 * タイムアウト、リトライ、レート制限をすべて適用
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ minDelayMs: 1000 });
 *
 * const response = await robustFetch('https://api.example.com/data', {
 *   timeoutMs: 10000,
 *   retry: { maxRetries: 3 },
 *   rateLimiter: limiter,
 * });
 * ```
 */
export async function robustFetch(
  url: string,
  options: RobustFetchOptions = {}
): Promise<Response> {
  const { init, timeoutMs = 30000, retry, rateLimiter } = options;

  // レート制限
  if (rateLimiter) {
    await rateLimiter.wait();
  }

  try {
    // タイムアウト付きfetchをリトライ（withRetryを使用）
    return await withRetry(
      () => fetchWithTimeout(url, init, timeoutMs),
      {
        shouldRetry: (error) => isRetryableError(error),
        ...retry,
      }
    );
  } finally {
    if (rateLimiter) {
      rateLimiter.done();
    }
  }
}

/**
 * ログ出力ヘルパー
 */
export const crawlerLog = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`[crawler] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[crawler] ⚠️ ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[crawler] ❌ ${message}`, ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log(`[crawler] ✅ ${message}`, ...args);
  },
  progress: (current: number, total: number, message?: string) => {
    const percent = Math.round((current / total) * 100);
    console.log(`[crawler] 📊 ${current}/${total} (${percent}%)${message ? ` - ${message}` : ''}`);
  },
};
