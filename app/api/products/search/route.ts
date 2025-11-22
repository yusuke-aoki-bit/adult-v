import { NextResponse } from 'next/server';
import { fuzzySearchProducts } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

/**
 * 商品をあいまい検索するAPIエンドポイント
 *
 * @param request - GET /api/products/search?q=xxx&limit=20
 * @returns 検索結果の商品リストまたはエラー
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    const products = await fuzzySearchProducts(query, limit);

    return NextResponse.json({
      products,
      count: products.length,
      query
    });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}
