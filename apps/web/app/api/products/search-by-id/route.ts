import { NextResponse } from 'next/server';
import { searchProductByProductId } from '@/lib/db/queries';

export const revalidate = 300; // 5分キャッシュ

/**
 * メーカー品番(originalProductId)またはnormalizedProductIdで商品を検索
 *
 * @param request - GET /api/products/search-by-id?productId=xxx
 * @returns 商品情報またはエラー
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const product = await searchProductByProductId(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error searching product by ID:', error);
    return NextResponse.json({ product: null, fallback: true });
  }
}
