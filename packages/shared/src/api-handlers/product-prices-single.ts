import { NextResponse } from 'next/server';

interface ProductSource {
  aspName: string;
  regularPrice: number | null;
  salePrice: number | null;
  affiliateUrl: string | null;
  discountPercent: number | null;
  saleEndAt: string | null;
  isSubscription: boolean | null;
  productType: string | null;
  isOnSale: boolean | null;
}

export interface ProductPricesSingleHandlerDeps {
  getProductSourcesWithSales: (productId: number) => Promise<ProductSource[]>;
  getProviderLabel: (aspName: string) => string;
}

export function createProductPricesSingleHandler(deps: ProductPricesSingleHandlerDeps) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const productId = parseInt(id);

      if (isNaN(productId)) {
        return NextResponse.json(
          { error: 'Invalid product ID' },
          { status: 400 },
        );
      }

      const sources = await deps.getProductSourcesWithSales(productId);

      const prices = sources.map((source) => ({
        asp: source.aspName,
        aspLabel: deps.getProviderLabel(source.aspName),
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
  };
}
