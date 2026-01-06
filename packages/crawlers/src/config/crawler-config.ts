/**
 * クローラー設定
 *
 * レート制限、タイムアウト、アフィリエイトIDなどを一元管理
 */

// ============================================================
// アフィリエイトID
// ============================================================

export const AFFILIATE_IDS = {
  FANZA: process.env['FANZA_AFFILIATE_ID'] || 'minpri-001',
  MGS: process.env['MGS_AFFILIATE_CODE'] || '6CS5PGEBQDUYPZLHYEM33TBZFJ',
  DUGA: process.env['DUGA_AFFILIATE_ID'] || '',
  SOKMIL: process.env['SOKMIL_AFFILIATE_ID'] || '',
  B10F: process.env['B10F_AFFILIATE_ID'] || '12556',
  FC2: process.env['FC2_AFFUID'] || 'TVRFNU5USTJOVEE9',
  DTI: process.env['DTI_AFFILIATE_ID'] || '',
} as const;

// ============================================================
// レート制限設定
// ============================================================

export interface RateLimitConfig {
  /** 最小待機時間（ミリ秒） */
  minDelayMs: number;
  /** ジッター（ランダム追加待機、ミリ秒） */
  jitterMs: number;
  /** 最大リトライ回数 */
  maxRetries: number;
  /** バックオフ倍率 */
  backoffMultiplier?: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // API系（高速）
  FANZA: {
    minDelayMs: parseInt(process.env['FANZA_RATE_LIMIT_MS'] || '3000', 10),
    jitterMs: parseInt(process.env['FANZA_JITTER_MS'] || '1500', 10),
    maxRetries: 3,
  },
  MGS: {
    minDelayMs: parseInt(process.env['MGS_RATE_LIMIT_MS'] || '2000', 10),
    jitterMs: parseInt(process.env['MGS_JITTER_MS'] || '500', 10),
    maxRetries: 3,
  },
  DUGA: {
    minDelayMs: parseInt(process.env['DUGA_RATE_LIMIT_MS'] || '1000', 10),
    jitterMs: parseInt(process.env['DUGA_JITTER_MS'] || '0', 10),
    maxRetries: 3,
  },
  SOKMIL: {
    minDelayMs: parseInt(process.env['SOKMIL_RATE_LIMIT_MS'] || '1000', 10),
    jitterMs: parseInt(process.env['SOKMIL_JITTER_MS'] || '300', 10),
    maxRetries: 3,
  },

  // スクレイピング系（慎重）
  DTI: {
    minDelayMs: parseInt(process.env['DTI_RATE_LIMIT_MS'] || '500', 10),
    jitterMs: parseInt(process.env['DTI_JITTER_MS'] || '300', 10),
    maxRetries: 3,
  },
  CARIBBEAN: {
    minDelayMs: parseInt(process.env['CARIBBEAN_RATE_LIMIT_MS'] || '3000', 10),
    jitterMs: parseInt(process.env['CARIBBEAN_JITTER_MS'] || '1000', 10),
    maxRetries: 3,
  },
  TOKYOHOT: {
    minDelayMs: parseInt(process.env['TOKYOHOT_RATE_LIMIT_MS'] || '3000', 10),
    jitterMs: parseInt(process.env['TOKYOHOT_JITTER_MS'] || '1000', 10),
    maxRetries: 3,
  },
  FC2: {
    minDelayMs: parseInt(process.env['FC2_RATE_LIMIT_MS'] || '3000', 10),
    jitterMs: parseInt(process.env['FC2_JITTER_MS'] || '1000', 10),
    maxRetries: 3,
  },
  B10F: {
    minDelayMs: parseInt(process.env['B10F_RATE_LIMIT_MS'] || '1000', 10),
    jitterMs: parseInt(process.env['B10F_JITTER_MS'] || '500', 10),
    maxRetries: 3,
  },
  TMP: {
    minDelayMs: parseInt(process.env['TMP_RATE_LIMIT_MS'] || '2000', 10),
    jitterMs: parseInt(process.env['TMP_JITTER_MS'] || '500', 10),
    maxRetries: 3,
  },
  JAPANSKA: {
    minDelayMs: parseInt(process.env['JAPANSKA_RATE_LIMIT_MS'] || '2000', 10),
    jitterMs: parseInt(process.env['JAPANSKA_JITTER_MS'] || '500', 10),
    maxRetries: 3,
  },

  // デフォルト
  DEFAULT: {
    minDelayMs: 2000,
    jitterMs: 500,
    maxRetries: 3,
  },
} as const;

/**
 * プロバイダー名からレート制限設定を取得
 */
export function getRateLimitConfig(provider: string): RateLimitConfig {
  const upperProvider = provider.toUpperCase();
  const config = RATE_LIMITS[upperProvider] ?? RATE_LIMITS['DEFAULT'];
  if (config) return config;
  return { minDelayMs: 2000, jitterMs: 500, maxRetries: 3 };
}

// ============================================================
// タイムアウト設定
// ============================================================

export const TIMEOUTS = {
  /** Cloud Scheduler呼び出し（秒） */
  cloudScheduler: parseInt(process.env['CRAWLER_TIMEOUT_CLOUD_SCHEDULER'] || '600', 10),
  /** APIハンドラー（秒） */
  apiHandler: parseInt(process.env['CRAWLER_TIMEOUT_API_HANDLER'] || '300', 10),
  /** Cloud Run Job（秒） */
  cloudRunJob: parseInt(process.env['CRAWLER_TIMEOUT_CLOUD_RUN_JOB'] || '3600', 10),
  /** 単一リクエスト（ミリ秒） */
  singleRequest: parseInt(process.env['CRAWLER_TIMEOUT_SINGLE_REQUEST'] || '30000', 10),
  /** ページロード（ミリ秒） */
  pageLoad: parseInt(process.env['CRAWLER_TIMEOUT_PAGE_LOAD'] || '60000', 10),
} as const;

// ============================================================
// パス設定
// ============================================================

export const PATHS = {
  /** 一時ファイルディレクトリ */
  tempDir: process.env['CRAWLER_TEMP_DIR'] || process.env['TEMP'] || '/tmp',
  /** GCSバケット名 */
  gcsBucket: process.env['GCS_BUCKET'] || 'adult-v-crawler-data',
  /** Puppeteer実行パス */
  puppeteerExecutable: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
} as const;

// ============================================================
// 通知設定
// ============================================================

export const NOTIFICATIONS = {
  /** Slack Webhook URL */
  slackWebhookUrl: process.env['SLACK_CRAWLER_WEBHOOK_URL'] || '',
  /** エラー率閾値（これを超えるとアラート） */
  errorRateThreshold: parseFloat(process.env['CRAWLER_ERROR_RATE_THRESHOLD'] || '0.1'),
} as const;

// ============================================================
// デフォルト値
// ============================================================

export const DEFAULTS = {
  /** デフォルト取得件数 */
  limit: parseInt(process.env['CRAWLER_DEFAULT_LIMIT'] || '100', 10),
  /** フルスキャン開始年 */
  fullScanStartYear: parseInt(process.env['CRAWLER_FULL_SCAN_START_YEAR'] || '2010', 10),
} as const;
