import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './routing';

// Known malicious bot patterns (aggressive scrapers, not search engines)
const MALICIOUS_BOT_PATTERNS = [
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

// Paths that are sensitive and need stricter protection
const SENSITIVE_PATHS = [
  '/api/age-verify',
  '/api/notifications',
  '/api/admin',
];

// SQL Injection patterns to block
const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
];

// XSS patterns to block
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
];

// Check if request is from a malicious bot
function isMaliciousBot(userAgent: string): boolean {
  return MALICIOUS_BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

// Check if path is sensitive
function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATHS.some(path => pathname.startsWith(path));
}

// Check for SQL injection attempts
function hasSqlInjection(url: string): boolean {
  try {
    const decodedUrl = decodeURIComponent(url);
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(decodedUrl));
  } catch {
    return false;
  }
}

// Check for XSS attempts
function hasXssAttempt(url: string): boolean {
  try {
    const decodedUrl = decodeURIComponent(url);
    return XSS_PATTERNS.some(pattern => pattern.test(decodedUrl));
  } catch {
    return false;
  }
}

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;
  const fullUrl = request.url;

  // 1. Security: Check for SQL Injection attempts
  if (hasSqlInjection(fullUrl)) {
    console.warn('[middleware] SQL Injection attempt blocked:', fullUrl.substring(0, 200));
    return new NextResponse('Bad Request', { status: 400 });
  }

  // 2. Security: Check for XSS attempts
  if (hasXssAttempt(fullUrl)) {
    console.warn('[middleware] XSS attempt blocked:', fullUrl.substring(0, 200));
    return new NextResponse('Bad Request', { status: 400 });
  }

  // 3. Check for malicious bots on sensitive paths
  if (isSensitivePath(pathname) && isMaliciousBot(userAgent)) {
    console.warn('[middleware] Blocked malicious bot:', userAgent.substring(0, 100));
    return new NextResponse('Access Denied', { status: 403 });
  }

  // 4. Block requests with suspicious headers
  const contentType = request.headers.get('content-type') || '';
  if (pathname.startsWith('/api') && request.method === 'POST') {
    // For POST requests to API, ensure proper content type
    if (contentType && !contentType.includes('application/json') &&
        !contentType.includes('application/x-www-form-urlencoded') &&
        !contentType.includes('multipart/form-data')) {
      console.warn('[middleware] Suspicious content-type:', contentType);
      return new NextResponse('Unsupported Media Type', { status: 415 });
    }
  }

  // 5. For API routes, skip intl middleware and add security headers
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    // Add CORS headers for API
    response.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  // 6. For static files and other paths, use intl middleware
  return intlMiddleware(request);
}

export const config = {
  // マッチするパス（静的ファイル、_nextを除外、APIは含める）
  matcher: [
    // ロケールプレフィックスが必要なパス + API
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
