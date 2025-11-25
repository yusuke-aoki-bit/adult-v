import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n';

// next-intlのミドルウェアを作成
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // 常にロケールプレフィックスを付ける
});

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

export default function proxy(request: NextRequest) {
  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
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

  const ageVerified = request.cookies.get('age-verified')?.value === 'true';
  const isAgeVerificationPage = request.nextUrl.pathname === '/age-verification';

  // SEOファイル（sitemap.xml, robots.txt）は検索エンジンのクローラーがアクセスできるよう常にアクセス可能
  const isSEOFile = request.nextUrl.pathname === '/sitemap.xml' ||
                    request.nextUrl.pathname === '/robots.txt';

  if (isSEOFile) {
    return NextResponse.next();
  }

  // 年齢確認ページ自体は常にアクセス可能
  if (isAgeVerificationPage) {
    return NextResponse.next();
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
    return intlMiddleware(request);
  }

  // 年齢確認済みでない場合は年齢確認ページにリダイレクト
  if (!ageVerified) {
    const url = request.nextUrl.clone();
    url.pathname = '/age-verification';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // next-intlのミドルウェアを実行
  return intlMiddleware(request);
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
