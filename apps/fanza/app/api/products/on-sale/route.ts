import { NextRequest, NextResponse } from 'next/server';
import { getSaleProducts } from '@/lib/db/queries';

export const revalidate = 300; // 5分キャッシュ

/**
 * セール中の商品を取得
 * GET /api/products/on-sale?limit=24&minDiscount=30&asp=FANZA
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const minDiscount = parseInt(searchParams.get('minDiscount') || '0', 10);
    const aspName = searchParams.get('asp') || undefined;

    const products = await getSaleProducts({
      limit: Math.min(limit, 100),
      minDiscount: minDiscount > 0 ? minDiscount : undefined,
      aspName,
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching sale products:', error);
    return NextResponse.json({ products: [], fallback: true });
  }
}
