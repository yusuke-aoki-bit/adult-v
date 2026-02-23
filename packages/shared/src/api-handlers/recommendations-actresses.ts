import { NextRequest, NextResponse } from 'next/server';

export interface RecommendationsActressesHandlerDeps {
  getRecommendedActressesFromFavorites: (ids: number[], limit: number) => Promise<unknown[]>;
}

export function createRecommendationsActressesHandler(deps: RecommendationsActressesHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { performerIds, limit = 8 } = await request.json();

      if (!Array.isArray(performerIds) || performerIds.length === 0) {
        return NextResponse.json({ recommendations: [] });
      }

      const numericIds = performerIds
        .map((id: string | number) => (typeof id === 'string' ? parseInt(id) : id))
        .filter((id: number) => !isNaN(id));

      if (numericIds.length === 0) {
        return NextResponse.json({ recommendations: [] });
      }

      const recommendations = await deps.getRecommendedActressesFromFavorites(numericIds, limit);

      return NextResponse.json({
        recommendations,
        basedOn: numericIds.length,
      });
    } catch (error) {
      console.error('Failed to get actress recommendations:', error);
      return NextResponse.json({ recommendations: [], fallback: true });
    }
  };
}
