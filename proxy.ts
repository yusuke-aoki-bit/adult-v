import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n';
import { getSiteMode, type SiteMode } from './lib/site-config';

// next-intlのミドルウェアを作成
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // 常にロケールプレフィックスを付ける
});

/**
 * ホスト名からサイトモードを検出
 * FANZAサブドメイン: f.adult-v.com, www.f.adult-v.com など
 */
function detectSiteMode(request: NextRequest): SiteMode {
  const hostname = request.headers.get('host') || request.nextUrl.hostname;
  return getSiteMode(hostname);
}

/**
 * サイトモードヘッダー付きのNextResponse.next()を返す
 */
function nextWithSiteHeaders(request: NextRequest, siteMode: SiteMode): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-site-mode', siteMode);
  if (siteMode === 'fanza') {
    requestHeaders.set('x-asp-filter', 'FANZA');
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * intlMiddlewareを実行し、サイトモードヘッダーを追加
 */
function intlMiddlewareWithSiteHeaders(request: NextRequest, siteMode: SiteMode): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-site-mode', siteMode);
  if (siteMode === 'fanza') {
    requestHeaders.set('x-asp-filter', 'FANZA');
  }

  // リクエストヘッダーを変更したリクエストでintlMiddlewareを実行
  const modifiedRequest = new NextRequest(request.url, {
    headers: requestHeaders,
    method: request.method,
  });

  // intlMiddlewareを実行
  const response = intlMiddleware(modifiedRequest);

  // レスポンスヘッダーにもサイトモードを追加
  response.headers.set('x-site-mode', siteMode);
  if (siteMode === 'fanza') {
    response.headers.set('x-asp-filter', 'FANZA');
  }

  return response;
}

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // max requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimit.entries()) {
    if (now > record.resetTime) {
      rateLimit.delete(ip);
    }
  }
}, 60 * 1000);

// ロケールなしURLをリダイレクトする必要があるパス（SEO対策）
const pathsRequiringLocale = [
  '/actress/',
  '/products/',
  '/categories',
  '/reviews',
  '/favorites',
  '/product/',
  '/privacy',
  '/uncategorized',
];

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // サイトモード検出（FANZAサブドメイン vs メインサイト）
  const siteMode = detectSiteMode(request);

  // Rate limiting for API routes
  if (pathname.startsWith('/api')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
  }

  // SEO対策: ロケールなしのURLを301リダイレクト
  // 例: /actress/123 -> /ja/actress/123
  const hasLocalePrefix = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!hasLocalePrefix) {
    const needsRedirect = pathsRequiringLocale.some(
      (path) => pathname.startsWith(path) || pathname === path.replace(/\/$/, '')
    );

    if (needsRedirect) {
      const url = request.nextUrl.clone();
      url.pathname = `/${defaultLocale}${pathname}`;
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  const ageVerified = request.cookies.get('age-verified')?.value === 'true';
  const isAgeVerificationPage = pathname === '/age-verification';

  // /admin ルートはロケールプレフィックスなしでアクセス可能（国際化をスキップ）
  if (pathname.startsWith('/admin')) {
    return nextWithSiteHeaders(request, siteMode);
  }

  // SEOファイル（sitemap.xml, robots.txt）は検索エンジンのクローラーがアクセスできるよう常にアクセス可能
  const isSEOFile = pathname === '/sitemap.xml' ||
                    pathname === '/robots.txt';

  if (isSEOFile) {
    return nextWithSiteHeaders(request, siteMode);
  }

  // 年齢確認ページ自体は常にアクセス可能
  if (isAgeVerificationPage) {
    return nextWithSiteHeaders(request, siteMode);
  }

  // 検索エンジンボット・PageSpeed Insightsは年齢確認をスキップ
  const userAgent = request.headers.get('user-agent') || '';
  const xPurpose = request.headers.get('x-purpose') || '';
  const xGooglePageSpeed = request.headers.get('x-mod-pagespeed') || request.headers.get('x-page-speed') || '';
  const referer = request.headers.get('referer') || '';

  // PageSpeed Insights detection (multiple methods)
  const isPageSpeed = xPurpose.includes('preview') ||
                     xGooglePageSpeed.length > 0 ||
                     userAgent.includes('Speed Insights') ||
                     referer.includes('pagespeed.web.dev') ||
                     referer.includes('developers.google.com/speed');

  // Bot detection - comprehensive list
  const isBot = /bot|crawl|spider|lighthouse|chrome-lighthouse|gtmetrix|pagespeed|headlesschrome|phantomjs|slurp|yahoo|bingbot|googlebot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|duckduckbot|bingpreview|google page speed insights|ptst/i.test(userAgent);

  // Check if request is coming from bot/crawler IP ranges (simplified check)
  const xForwardedFor = request.headers.get('x-forwarded-for') || '';
  const isGoogleIP = xForwardedFor.includes('66.249.') || // Google IP range
                     xForwardedFor.includes('64.233.') ||
                     xForwardedFor.includes('72.14.');

  // For debugging - log all bot detection attempts
  if (isBot || isPageSpeed || isGoogleIP) {
    console.log('Bot/PageSpeed/GoogleIP detected:', {
      userAgent: userAgent.substring(0, 100),
      xPurpose,
      xGooglePageSpeed,
      referer,
      xForwardedFor: xForwardedFor.substring(0, 50),
      isPageSpeed,
      isBot,
      isGoogleIP,
    });
  }

  if (isBot || isPageSpeed || isGoogleIP) {
    return intlMiddlewareWithSiteHeaders(request, siteMode);
  }

  // 年齢確認済みでない場合は年齢確認ページにリダイレクト
  if (!ageVerified) {
    const url = request.nextUrl.clone();
    url.pathname = '/age-verification';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // next-intlのミドルウェアを実行（サイトモードヘッダー付き）
  return intlMiddlewareWithSiteHeaders(request, siteMode);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
