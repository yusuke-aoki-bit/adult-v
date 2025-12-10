import { NextResponse } from 'next/server';
import { getActresses, getFeaturedActresses } from '@/lib/db/queries';
import { validatePagination, validateSearchQuery } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if requesting featured actresses
    const featured = searchParams.get('featured') === 'true';
    if (featured) {
      const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 20);
      const actresses = await getFeaturedActresses(limit);
      return NextResponse.json({ actresses, total: actresses.length });
    }

    // Validate pagination
    const paginationResult = validatePagination(searchParams);
    if (!paginationResult.valid) {
      return paginationResult.error;
    }
    const { limit, offset } = paginationResult.params!;

    const query = validateSearchQuery(searchParams.get('query'));

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


