import { NextResponse } from 'next/server';
import { validatePagination, validateSearchQuery, validatePriceRange } from '../lib/api-utils';
import { CACHE, CacheControl } from './constants/cache';
import { createApiErrorResponse } from '../lib/api-logger';

export type SortOption =
  | 'releaseDateDesc'
  | 'releaseDateAsc'
  | 'priceDesc'
  | 'priceAsc'
  | 'ratingDesc'
  | 'ratingAsc'
  | 'titleAsc';

const VALID_SORT_OPTIONS: SortOption[] = [
  'releaseDateDesc',
  'releaseDateAsc',
  'priceDesc',
  'priceAsc',
  'ratingDesc',
  'ratingAsc',
  'titleAsc',
];

export interface GetProductsParams {
  limit: number;
  offset: number;
  ids?: number[];
  category?: string;
  provider?: string;
  providers?: string[];
  excludeProviders?: string[];
  actressId?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  hasVideo?: boolean;
  hasImage?: boolean;
  query?: string;
  sortBy?: SortOption;
  minPrice?: number;
  maxPrice?: number;
  locale?: string;
}

export interface ProductsHandlerDeps {
  getProducts: (params: GetProductsParams) => Promise<unknown[]>;
}

export interface ProductsHandlerOptions {
  /** web版: IDs指定時にlimit/offsetを調整する（limit=ids.length, offset=0） */
  adjustLimitOffsetForIds?: boolean;
}

export function createProductsHandler(
  deps: ProductsHandlerDeps,
  options: ProductsHandlerOptions = {}
) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);

      // Validate pagination
      const paginationResult = validatePagination(searchParams);
      if (!paginationResult.valid) {
        return paginationResult.error;
      }
      const { limit, offset } = paginationResult.params!;

      // Parse IDs parameter (comma-separated list of numeric IDs)
      const idsParam = searchParams.get('ids');
      let ids: number[] | undefined;
      if (idsParam) {
        ids = idsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        if (ids.length === 0) {
          ids = undefined;
        }
      }

      // Parse and validate other parameters
      const category = searchParams.get('category') || undefined;
      const provider = searchParams.get('provider') || undefined;

      // Parse includeAsp and excludeAsp (comma-separated lists)
      const includeAspParam = searchParams.get('includeAsp');
      const providers = includeAspParam
        ? includeAspParam.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const excludeAspParam = searchParams.get('excludeAsp');
      const excludeProviders = excludeAspParam
        ? excludeAspParam.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const actressId = searchParams.get('actressId') || undefined;
      const isFeatured = searchParams.get('isFeatured') === 'true' ? true : undefined;
      const isNew = searchParams.get('isNew') === 'true' ? true : undefined;
      const hasVideo = searchParams.get('hasVideo') === 'true' ? true : undefined;
      const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined;
      const query = validateSearchQuery(searchParams.get('query'));

      // Validate sort option
      const sortByParam = searchParams.get('sort');
      const sortBy: SortOption | undefined = sortByParam && VALID_SORT_OPTIONS.includes(sortByParam as SortOption)
        ? (sortByParam as SortOption)
        : undefined;

      // Validate price range
      const { minPrice, maxPrice } = validatePriceRange(searchParams.get('priceRange'));

      // Parse locale parameter (hl or locale)
      const locale = searchParams.get('hl') || searchParams.get('locale') || 'ja';

      // Adjust limit/offset for IDs if option is set
      const finalLimit = options.adjustLimitOffsetForIds && ids ? ids.length : limit;
      const finalOffset = options.adjustLimitOffsetForIds && ids ? 0 : offset;

      const products = await deps.getProducts({
        limit: finalLimit,
        offset: finalOffset,
        ids,
        category,
        provider,
        providers: providers && providers.length > 0 ? providers : undefined,
        excludeProviders: excludeProviders && excludeProviders.length > 0 ? excludeProviders : undefined,
        actressId,
        isFeatured,
        isNew,
        hasVideo,
        hasImage,
        query,
        sortBy: sortBy || undefined,
        minPrice,
        maxPrice,
        locale,
      });

      // Determine cache duration based on request type
      // ID-based requests are stable - cache longer
      // Search/filter requests change more frequently
      let cacheControl: CacheControl = CACHE.FIVE_MIN;
      if (ids && ids.length > 0) {
        cacheControl = CACHE.ONE_HOUR; // Stable product IDs
      } else if (query) {
        cacheControl = CACHE.ONE_MIN; // Search results more dynamic
      } else if (actressId) {
        cacheControl = CACHE.ONE_HOUR; // Actress-specific results are stable
      } else if (!category && !provider && !providers) {
        cacheControl = CACHE.FIVE_MIN; // General list
      }

      return NextResponse.json(
        { products, total: products.length, limit, offset },
        {
          headers: {
            'Cache-Control': cacheControl,
            'Vary': 'Accept-Encoding',
          }
        }
      );
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch products', 500, {
        endpoint: '/api/products',
      });
    }
  };
}
