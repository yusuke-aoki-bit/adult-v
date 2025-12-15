import { NextResponse } from 'next/server';
import { getViewingPatternStats } from '@/lib/db/recommendations';

/**
 * GET /api/products/[id]/viewing-patterns
 * E2機能: みんなの視聴パターン統計
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const stats = await getViewingPatternStats(productId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get viewing pattern stats:', error);
    return NextResponse.json({
      alsoViewed: [],
      popularTimes: [],
      viewerProfile: {
        avgProductsViewed: 0,
        topGenres: [],
        repeatViewRate: 0,
      },
    }, { status: 500 });
  }
}

// 10分キャッシュ
export const revalidate = 600;
