import { NextResponse } from 'next/server';
import { getProducts, type SortOption } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 100;
    const offset = Number(searchParams.get('offset')) || 0;
    const category = searchParams.get('category') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const actressId = searchParams.get('actressId') || undefined;
    const isFeatured = searchParams.get('isFeatured') === 'true' ? true : undefined;
    const isNew = searchParams.get('isNew') === 'true' ? true : undefined;
    const query = searchParams.get('query') || undefined;
    const sortBy = searchParams.get('sort') as SortOption | null;
    const priceRange = searchParams.get('priceRange') || undefined;

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

    // 価格範囲の解析
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    if (priceRange && priceRange !== 'all') {
      if (priceRange === '3000') {
        minPrice = 3000;
      } else {
        const [min, max] = priceRange.split('-').map(Number);
        minPrice = min;
        maxPrice = max;
      }
    }

    const products = await getProducts({
      limit,
      offset,
      category,
      provider,
      actressId,
      isFeatured,
      isNew,
      query,
      sortBy: sortBy || undefined,
      minPrice,
      maxPrice,
    });

    return NextResponse.json({
      products,
      total: products.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}


