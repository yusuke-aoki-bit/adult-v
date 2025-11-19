import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const ageVerified = request.cookies.get('age-verified')?.value === 'true';
  const isAgeVerificationPage = request.nextUrl.pathname === '/age-verification';

  // 年齢確認ページ自体は常にアクセス可能
  if (isAgeVerificationPage) {
    return NextResponse.next();
  }

  // 年齢確認済みでない場合は年齢確認ページにリダイレクト
  if (!ageVerified) {
    const url = request.nextUrl.clone();
    url.pathname = '/age-verification';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
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



