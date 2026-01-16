import { NextRequest, NextResponse } from 'next/server';

/**
 * URL正規化ミドルウェア
 * 重複ページ対策のため、不要なパラメータを削除してリダイレクト
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const searchParams = url.searchParams;
  let shouldRedirect = false;

  // ?page=1 を削除（ページ1はデフォルトなので不要）
  if (searchParams.get('page') === '1') {
    searchParams.delete('page');
    shouldRedirect = true;
  }

  // ?perPage=48 を削除（デフォルト値）
  if (searchParams.get('perPage') === '48') {
    searchParams.delete('perPage');
    shouldRedirect = true;
  }

  // ?sort=releaseDate を削除（デフォルト値）
  // 注: 一部ページではデフォルトがrecentなので、ページごとに調整が必要な場合は除外
  // if (searchParams.get('sort') === 'releaseDate') {
  //   searchParams.delete('sort');
  //   shouldRedirect = true;
  // }

  // 空のパラメータを削除
  for (const [key, value] of Array.from(searchParams.entries())) {
    if (value === '' || value === 'undefined' || value === 'null') {
      searchParams.delete(key);
      shouldRedirect = true;
    }
  }

  // リダイレクトが必要な場合は301リダイレクト
  if (shouldRedirect) {
    url.search = searchParams.toString();
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: [
    // 静的ファイル、API、_nextを除外
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap|monitoring).*)',
  ],
};
