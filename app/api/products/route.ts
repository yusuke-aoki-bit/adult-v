import { NextResponse } from 'next/server';
import { getProducts, type SortOption } from '@/lib/db/queries';
import {
  validatePagination,
  validateSearchQuery,
  validatePriceRange,
} from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const VALID_SORT_OPTIONS: SortOption[] = [
  'releaseDateDesc',
  'releaseDateAsc',
  'priceDesc',
  'priceAsc',
  'ratingDesc',
  'ratingAsc',
  'titleAsc',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate pagination
    const paginationResult = validatePagination(searchParams);
    if (!paginationResult.valid) {
      return paginationResult.error;
    }
    const { limit, offset } = paginationResult.params!;

    // Parse and validate other parameters
    const category = searchParams.get('category') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const actressId = searchParams.get('actressId') || undefined;
    const isFeatured = searchParams.get('isFeatured') === 'true' ? true : undefined;
    const isNew = searchParams.get('isNew') === 'true' ? true : undefined;
    const query = validateSearchQuery(searchParams.get('query'));

    // Validate sort option
    const sortByParam = searchParams.get('sort');
    const sortBy: SortOption | undefined = sortByParam && VALID_SORT_OPTIONS.includes(sortByParam as SortOption)
      ? (sortByParam as SortOption)
      : undefined;

    // Validate price range
    const { minPrice, maxPrice } = validatePriceRange(searchParams.get('priceRange'));

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


