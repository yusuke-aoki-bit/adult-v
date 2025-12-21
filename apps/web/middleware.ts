import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './routing';
import {
  defaultLocale,
  getLocaleFromHlParam,
  getLocaleFromCookie,
  detectLocalePrefix,
  isMaliciousBot,
  isSensitivePath,
  hasSqlInjection,
  hasXssAttempt,
} from '@adult-v/shared/i18n/middleware-helpers';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast path: API routes - minimal processing
  if (pathname.startsWith('/api')) {
    const fullUrl = request.url;

    // Security checks only for API routes (performance optimization)
    if (hasSqlInjection(fullUrl)) {
      console.warn('[middleware] SQL Injection attempt blocked:', fullUrl.substring(0, 200));
      return new NextResponse('Bad Request', { status: 400 });
    }

    if (hasXssAttempt(fullUrl)) {
      console.warn('[middleware] XSS attempt blocked:', fullUrl.substring(0, 200));
      return new NextResponse('Bad Request', { status: 400 });
    }

    // Block requests with suspicious headers for POST
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType && !contentType.includes('application/json') &&
          !contentType.includes('application/x-www-form-urlencoded') &&
          !contentType.includes('multipart/form-data')) {
        console.warn('[middleware] Suspicious content-type:', contentType);
        return new NextResponse('Unsupported Media Type', { status: 415 });
      }
    }

    const response = NextResponse.next();
    // Add CORS headers for API
    response.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  // Page routes: Check for malicious bots on sensitive paths only
  const userAgent = request.headers.get('user-agent') || '';
  if (isSensitivePath(pathname) && isMaliciousBot(userAgent)) {
    console.warn('[middleware] Blocked malicious bot:', userAgent.substring(0, 100));
    return new NextResponse('Access Denied', { status: 403 });
  }

  // 6. ロケールプレフィックス → ?hl= パラメータへの301リダイレクト（SEO対応）
  // /ja/, /en/, /zh/, /zh-TW/, /ko/ をすべて ?hl= 形式に変換
  const { locale: prefixLocale, newPath } = detectLocalePrefix(pathname);
  if (prefixLocale) {
    const newUrl = new URL(newPath || '/', request.url);
    // 既存のクエリパラメータを保持
    request.nextUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });
    // デフォルトロケール(ja)以外は ?hl= パラメータを追加
    if (prefixLocale !== defaultLocale) {
      newUrl.searchParams.set('hl', prefixLocale);
    }
    return NextResponse.redirect(newUrl, 301);
  }

  // 7. ?hl= パラメータで言語切り替え（クッキーに保存）
  const hlLocale = getLocaleFromHlParam(request.nextUrl.searchParams);
  if (hlLocale) {
    // hlパラメータがある場合、その言語をクッキーに設定してintlMiddlewareに渡す
    const response = intlMiddleware(request);
    // NEXT_LOCALEクッキーを設定（next-intlが使用）
    response.cookies.set('NEXT_LOCALE', hlLocale, {
      maxAge: 365 * 24 * 60 * 60, // 1年
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // 8. クッキーから言語を取得（?hl=がない場合の継続セッション用）
  const cookieLocale = getLocaleFromCookie(request.cookies.get('NEXT_LOCALE')?.value);
  if (cookieLocale && cookieLocale !== defaultLocale) {
    // クッキーに保存された言語でintlMiddlewareを実行
    const response = intlMiddleware(request);
    return response;
  }

  // 9. For static files and other paths, use intl middleware with default locale
  return intlMiddleware(request);
}

export const config = {
  // マッチするパス（静的ファイル、_nextを除外、APIは含める）
  matcher: [
    // ロケールプレフィックスが必要なパス + API
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
