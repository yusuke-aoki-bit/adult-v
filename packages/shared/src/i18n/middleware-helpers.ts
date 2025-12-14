/**
 * i18n Middleware ヘルパー関数
 * apps/web と apps/fanza で共通使用
 */

import { locales, defaultLocale, type Locale, isValidLocale } from './index';

export { locales, defaultLocale, type Locale, isValidLocale };

/**
 * ?hl= パラメータから言語を取得
 */
export function getLocaleFromHlParam(searchParams: URLSearchParams): Locale | null {
  const hlParam = searchParams.get('hl');
  if (hlParam && isValidLocale(hlParam)) {
    return hlParam;
  }
  return null;
}

/**
 * クッキーから言語を取得
 */
export function getLocaleFromCookie(cookieValue: string | undefined): Locale | null {
  if (cookieValue && isValidLocale(cookieValue)) {
    return cookieValue;
  }
  return null;
}

/**
 * パスからロケールプレフィックスを検出（301リダイレクト用）
 * 全言語 (/ja/, /en/, /zh/, /zh-TW/, /ko/) を ?hl= パラメータに変換
 */
export function detectLocalePrefix(pathname: string): { locale: Locale | null; newPath: string } {
  // /zh-TW を先にチェック（/zh より長い）
  if (pathname === '/zh-TW' || pathname.startsWith('/zh-TW/')) {
    const newPath = pathname === '/zh-TW' ? '/' : pathname.substring(6);
    return { locale: 'zh-TW', newPath };
  }

  // 他のロケール
  for (const loc of ['ja', 'en', 'zh', 'ko'] as const) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      const newPath = pathname === `/${loc}` ? '/' : pathname.substring(loc.length + 1);
      return { locale: loc, newPath };
    }
  }

  return { locale: null, newPath: pathname };
}

/**
 * セキュリティ: 悪意のあるボットパターン
 */
export const MALICIOUS_BOT_PATTERNS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /httpclient/i,
  /java\//i,
  /libwww/i,
  /Screaming Frog/i,
  /HeadlessChrome\/\d+.*Headless/i,
  /PhantomJS/i,
  /Puppeteer/i,
  /Playwright/i,
];

/**
 * セキュリティ: 保護が必要なパス
 */
export const SENSITIVE_PATHS = [
  '/api/age-verify',
  '/api/notifications',
  '/api/admin',
];

/**
 * セキュリティ: SQLインジェクションパターン
 */
export const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
];

/**
 * セキュリティ: XSSパターン
 */
export const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
];

/**
 * 悪意のあるボットかどうかを判定
 */
export function isMaliciousBot(userAgent: string): boolean {
  return MALICIOUS_BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

/**
 * センシティブなパスかどうかを判定
 */
export function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATHS.some(path => pathname.startsWith(path));
}

/**
 * SQLインジェクションを検出
 */
export function hasSqlInjection(url: string): boolean {
  try {
    const decodedUrl = decodeURIComponent(url);
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(decodedUrl));
  } catch {
    return false;
  }
}

/**
 * XSS攻撃を検出
 */
export function hasXssAttempt(url: string): boolean {
  try {
    const decodedUrl = decodeURIComponent(url);
    return XSS_PATTERNS.some(pattern => pattern.test(decodedUrl));
  } catch {
    return false;
  }
}
