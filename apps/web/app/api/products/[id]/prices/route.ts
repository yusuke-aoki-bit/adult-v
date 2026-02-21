import { NextResponse } from 'next/server';
import { getProductSourcesWithSales } from '@/lib/db/queries';
import { getProviderLabel } from '@adult-v/shared';

export const revalidate = 300; // 5分キャッシュ

/**
 * 商品の価格情報を取得（複数ASP対応）
 * GET /api/products/[id]/prices
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const sources = await getProductSourcesWithSales(productId);

    const prices = sources.map((source) => ({
      asp: source.aspName,
      aspLabel: getProviderLabel(source.aspName),
      price: source.salePrice ?? source.regularPrice ?? 0,
      affiliateUrl: source.affiliateUrl,
      inStock: true,
      regularPrice: source.regularPrice,
      salePrice: source.salePrice,
      discountPercent: source.discountPercent,
      saleEndAt: source.saleEndAt,
      isSubscription: source.isSubscription,
      productType: source.productType,
      isOnSale: source.isOnSale,
    }));

    return NextResponse.json({ prices });
  } catch (error) {
    console.error('Error fetching product prices:', error);
    return NextResponse.json({ prices: [], fallback: true });
  }
}
