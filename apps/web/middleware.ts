import createMiddleware from 'next-intl/middleware';
import { routing } from './routing';

export default createMiddleware(routing);

export const config = {
  // マッチするパス（静的ファイル、API、_nextを除外）
  matcher: [
    // ロケールプレフィックスが必要なパス
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
