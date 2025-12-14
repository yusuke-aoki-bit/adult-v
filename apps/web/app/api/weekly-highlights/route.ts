import { NextResponse } from 'next/server';
import { getWeeklyHighlights } from '@/lib/db/recommendations';

/**
 * GET /api/weekly-highlights
 * B4機能: 今週の注目（自動キュレーション）
 */
export async function GET() {
  try {
    const highlights = await getWeeklyHighlights();

    return NextResponse.json(highlights);
  } catch (error) {
    console.error('Failed to get weekly highlights:', error);
    return NextResponse.json({
      trendingActresses: [],
      hotNewReleases: [],
      rediscoveredClassics: [],
    }, { status: 500 });
  }
}

// 1時間キャッシュ
export const revalidate = 3600;
