import { NextRequest, NextResponse } from 'next/server';
import { getCalendarDetailData } from '@adult-v/shared/db-queries';

export const revalidate = 300; // 5分キャッシュ

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);

    // 年月の妥当性チェック
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    const data = await getCalendarDetailData(year, month, 4, 2);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Calendar detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
