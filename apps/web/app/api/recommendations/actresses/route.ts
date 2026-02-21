import { NextRequest, NextResponse } from 'next/server';
import { getRecommendedActressesFromFavorites } from '@/lib/db/recommendations';

export const revalidate = 300;

/**
 * POST /api/recommendations/actresses
 * B1機能: 「この女優が好きなら」レコメンド
 * お気に入り女優IDリストから類似女優を取得
 */
export async function POST(request: NextRequest) {
  try {
    const { performerIds, limit = 8 } = await request.json();

    if (!Array.isArray(performerIds) || performerIds.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // Convert string IDs to numbers
    const numericIds = performerIds
      .map((id: string | number) => typeof id === 'string' ? parseInt(id) : id)
      .filter((id: number) => !isNaN(id));

    if (numericIds.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const recommendations = await getRecommendedActressesFromFavorites(numericIds, limit);

    return NextResponse.json({
      recommendations,
      basedOn: numericIds.length,
    });
  } catch (error) {
    console.error('Failed to get actress recommendations:', error);
    return NextResponse.json({ recommendations: [], fallback: true });
  }
}
