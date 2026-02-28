import { NextRequest, NextResponse } from 'next/server';
import { getDailyReleases } from '../db-queries';
import { CACHE } from './constants/cache';

export const revalidate = 3600; // 1時間キャッシュ

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);

  // バリデーション
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  try {
    const data = await getDailyReleases(year, month);
    return NextResponse.json(
      { data },
      {
        headers: {
          'Cache-Control': CACHE.ONE_HOUR,
        },
      },
    );
  } catch (error) {
    console.error('Daily releases API error:', error);
    return NextResponse.json(
      { data: [], fallback: true },
      {
        headers: {
          'Cache-Control': CACHE.ONE_MIN,
        },
      },
    );
  }
}
