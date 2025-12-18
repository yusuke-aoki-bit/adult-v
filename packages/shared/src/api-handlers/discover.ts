import { NextRequest, NextResponse } from 'next/server';

export interface DiscoverProduct {
  id: number;
  title: string;
  imageUrl: string;
  sampleImages: string[] | null;
  releaseDate: string | null;
  duration: number | null;
  price: number | null;
  provider: string | null;
  affiliateUrl: string | null;
  performers: string[];
}

export interface DiscoverHandlerDeps {
  getRandomProduct: (params: {
    excludeIds: number[];
    locale: string;
  }) => Promise<DiscoverProduct | null>;
}

export function createDiscoverHandler(deps: DiscoverHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);

      const excludeIdsParam = searchParams.get('excludeIds');
      const excludeIds = excludeIdsParam ? excludeIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const locale = searchParams.get('locale') || 'ja';

      const product = await deps.getRandomProduct({ excludeIds, locale });

      return NextResponse.json({ product });
    } catch (error) {
      console.error('Error fetching random product:', error);
      return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
    }
  };
}
