import { NextRequest, NextResponse } from 'next/server';

export interface RecommendationsHandlerDeps {
  getRecommendationsFromFavorites: (productIds: number[], limit: number) => Promise<unknown[]>;
}

export function createRecommendationsHandler(deps: RecommendationsHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { productIds, limit = 12 } = await request.json();

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return NextResponse.json({ recommendations: [] });
      }

      // Convert string IDs to numbers
      const numericIds = productIds
        .map((id: string | number) => typeof id === 'string' ? parseInt(id) : id)
        .filter((id: number) => !isNaN(id));

      if (numericIds.length === 0) {
        return NextResponse.json({ recommendations: [] });
      }

      const recommendations = await deps.getRecommendationsFromFavorites(numericIds, limit);

      return NextResponse.json({
        recommendations,
        basedOn: numericIds.length,
      });
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return NextResponse.json({ recommendations: [], error: 'Failed to get recommendations' }, { status: 500 });
    }
  };
}
