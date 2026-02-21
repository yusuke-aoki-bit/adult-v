import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * オンデマンド再検証ハンドラー
 *
 * クローラーが新しいコンテンツを追加した後に呼び出して
 * 関連ページのISRキャッシュを即座に無効化する
 *
 * Usage:
 *   POST /api/revalidate
 *   Body: { "paths": ["/products/123", "/"], "tags": ["products"] }
 *
 *   GET /api/revalidate?path=/products/123&path=/
 */
export function createRevalidateHandler(deps: {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
}) {
  return async function handler(request: NextRequest): Promise<NextResponse> {
    // 認証チェック
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    try {
      const revalidated: string[] = [];

      if (request.method === 'POST') {
        const body = await request.json();
        const paths: string[] = body.paths || [];
        const tags: string[] = body.tags || [];

        for (const path of paths) {
          revalidatePath(path);
          revalidated.push(`path:${path}`);
        }

        for (const tag of tags) {
          revalidateTag(tag, 'max');
          revalidated.push(`tag:${tag}`);
        }
      } else {
        // GET: クエリパラメータから
        const url = new URL(request.url);
        const paths = url.searchParams.getAll('path');
        const tags = url.searchParams.getAll('tag');

        for (const path of paths) {
          revalidatePath(path);
          revalidated.push(`path:${path}`);
        }

        for (const tag of tags) {
          revalidateTag(tag, 'max');
          revalidated.push(`tag:${tag}`);
        }
      }

      // 何も指定されていない場合はトップページとリスト系をrevalidate
      if (revalidated.length === 0) {
        const defaultPaths = [
          '/',
          '/products',
          '/lists/ranking',
          '/sales',
          '/calendar',
          '/rookies',
          '/daily-pick',
        ];
        for (const path of defaultPaths) {
          revalidatePath(path);
          revalidated.push(`path:${path}`);
        }
      }

      return NextResponse.json({
        success: true,
        revalidated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Revalidation failed', message: String(error) },
        { status: 500 },
      );
    }
  };
}
