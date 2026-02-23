import { NextResponse } from 'next/server';

type SortOption =
  | 'releaseDateDesc'
  | 'releaseDateAsc'
  | 'priceAsc'
  | 'priceDesc'
  | 'ratingDesc'
  | 'ratingAsc'
  | 'reviewCountDesc'
  | 'titleAsc';

const VALID_SORT_OPTIONS: SortOption[] = [
  'releaseDateDesc',
  'releaseDateAsc',
  'priceAsc',
  'priceDesc',
  'ratingDesc',
  'ratingAsc',
  'reviewCountDesc',
  'titleAsc',
];

function isValidSortOption(value: string | null): value is SortOption {
  return value !== null && VALID_SORT_OPTIONS.includes(value as SortOption);
}

function sanitizeNumber(value: string | null, defaultValue: number, min: number, max: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(parsed, max));
}

export interface ProductSearchHandlerDeps {
  getProducts: (options: any) => Promise<any[]>;
}

export function createProductSearchHandler(deps: ProductSearchHandlerDeps) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      const site = searchParams.get('site');
      const sortByParam = searchParams.get('sortBy');
      const tagsParam = searchParams.get('tags');
      const excludeTags = searchParams.get('excludeTags');
      const hasVideo = searchParams.get('hasVideo') === 'true' ? true : undefined;
      const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined;

      const limit = sanitizeNumber(searchParams.get('limit'), 50, 1, 100);
      const offset = sanitizeNumber(searchParams.get('offset'), 0, 0, 10000);
      const minPrice = searchParams.get('minPrice')
        ? sanitizeNumber(searchParams.get('minPrice'), 0, 0, 1000000)
        : undefined;
      const maxPrice = searchParams.get('maxPrice')
        ? sanitizeNumber(searchParams.get('maxPrice'), 1000000, 0, 1000000)
        : undefined;

      const sortBy: SortOption = isValidSortOption(sortByParam) ? sortByParam : 'releaseDateDesc';

      if (!query) {
        return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
      }
      if (query.length > 200) {
        return NextResponse.json({ error: 'Search query is too long (max 200 characters)' }, { status: 400 });
      }

      const tagIds = tagsParam ? tagsParam.split(',').filter((id) => /^\d+$/.test(id)) : undefined;
      const excludeTagIds = excludeTags ? excludeTags.split(',').filter((id) => /^\d+$/.test(id)) : undefined;

      const products = await deps.getProducts({
        query,
        limit,
        offset,
        provider: site || undefined,
        minPrice,
        maxPrice,
        sortBy,
        tags: tagIds,
        excludeTags: excludeTagIds,
        hasVideo,
        hasImage,
      });

      return NextResponse.json({
        products,
        count: products.length,
        query,
        filters: { site, minPrice, maxPrice, sortBy, tags: tagIds, excludeTags: excludeTagIds, hasVideo, hasImage },
      });
    } catch (error) {
      console.error('Error searching products:', error);
      return NextResponse.json({ products: [], count: 0, query: '', fallback: true, filters: {} });
    }
  };
}
