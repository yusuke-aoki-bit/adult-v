import { NextResponse } from 'next/server';
import { getActresses } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 100;
    const offset = Number(searchParams.get('offset')) || 0;
    const query = searchParams.get('query') || undefined;

    // リクエストバリデーション
    if (limit < 0 || limit > 1000) {
      return NextResponse.json(
        { error: 'Limit must be between 0 and 1000' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    const actresses = await getActresses({ limit, offset, query });

    return NextResponse.json({
      actresses,
      total: actresses.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching actresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actresses' },
      { status: 500 }
    );
  }
}


