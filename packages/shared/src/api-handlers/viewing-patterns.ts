import { NextResponse } from 'next/server';

export interface ViewingPatternsHandlerDeps {
  getViewingPatternStats: (productId: number) => Promise<unknown>;
}

export function createViewingPatternsHandler(deps: ViewingPatternsHandlerDeps) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const productId = parseInt(id);

      if (isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
      }

      const stats = await deps.getViewingPatternStats(productId);

      return NextResponse.json(stats);
    } catch (error) {
      console.error('Failed to get viewing pattern stats:', error);
      return NextResponse.json({
        fallback: true,
        alsoViewed: [],
        popularTimes: [],
        viewerProfile: {
          avgProductsViewed: 0,
          topGenres: [],
          repeatViewRate: 0,
        },
      });
    }
  };
}
