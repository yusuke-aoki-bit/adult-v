import { NextRequest, NextResponse } from 'next/server';
import { getPopularMakers, analyzeMakerPreference } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as 'maker' | 'label' | 'both' || 'both';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const locale = searchParams.get('locale') || 'ja';

    const makers = await getPopularMakers({
      category,
      limit,
      locale,
    });

    return NextResponse.json({ makers });
  } catch (error) {
    console.error('Error fetching makers:', error);
    return NextResponse.json({ makers: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, locale = 'ja' } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ makers: [] });
    }

    const makers = await analyzeMakerPreference(productIds, locale);

    return NextResponse.json({ makers });
  } catch (error) {
    console.error('Error analyzing maker preference:', error);
    return NextResponse.json({ makers: [] }, { status: 500 });
  }
}
