import { NextResponse } from 'next/server';
import { validatePagination, validateSearchQuery } from '../lib/api-utils';
import { CACHE } from './constants/cache';
import { createApiErrorResponse } from '../lib/api-logger';

export type ActressSortOption = 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';

const VALID_SORT_OPTIONS: ActressSortOption[] = ['nameAsc', 'nameDesc', 'productCountDesc', 'productCountAsc', 'recent'];

export interface ActressesHandlerDeps {
  getActresses: (params: { limit: number; offset: number; query?: string; ids?: number[]; sortBy?: ActressSortOption }) => Promise<unknown[]>;
  getActressesCount?: (params?: { query?: string }) => Promise<number>;
  getFeaturedActresses: (limit: number) => Promise<unknown[]>;
}

export function createActressesHandler(deps: ActressesHandlerDeps) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request['url']);

      // Check if requesting featured actresses
      const featured = searchParams.get('featured') === 'true';
      if (featured) {
        const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 20);
        const actresses = await deps.getFeaturedActresses(limit);
        return NextResponse.json(
          { actresses, total: actresses.length },
          { headers: { 'Cache-Control': CACHE.ONE_HOUR } }
        );
      }

      // Parse IDs parameter (comma-separated list of numeric IDs)
      const idsParam = searchParams.get('ids');
      let ids: number[] | undefined;
      if (idsParam) {
        ids = idsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        if (ids.length === 0) {
          ids = undefined;
        }
      }

      // If IDs are provided, fetch by IDs directly (stable cache key)
      if (ids && ids.length > 0) {
        const actresses = await deps.getActresses({ limit: ids.length, offset: 0, ids });
        return NextResponse.json(
          { actresses, total: actresses.length },
          { headers: { 'Cache-Control': CACHE.ONE_HOUR } }
        );
      }

      // Validate pagination
      const paginationResult = validatePagination(searchParams);
      if (!paginationResult.valid) {
        return paginationResult.error;
      }
      const { limit, offset } = paginationResult.params!;

      const query = validateSearchQuery(searchParams.get('query'));

      // sortByパラメータを解析
      const sortByParam = searchParams.get('sort');
      const sortBy: ActressSortOption | undefined = sortByParam && VALID_SORT_OPTIONS.includes(sortByParam as ActressSortOption)
        ? (sortByParam as ActressSortOption)
        : undefined;

      const actresses = await deps.getActresses({
        limit,
        offset,
        ...(query && { query }),
        ...(sortBy && { sortBy }),
      });

      // 総件数を取得（getActressesCountが提供されている場合）
      const total = deps.getActressesCount
        ? await deps.getActressesCount(query ? { query } : undefined)
        : actresses.length;

      // Search results cache shorter, static lists cache longer
      const cacheControl = query ? CACHE.FIVE_MIN : CACHE.ONE_HOUR;

      return NextResponse.json(
        { actresses, total, limit, offset },
        { headers: { 'Cache-Control': cacheControl } }
      );
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch actresses', 500, {
        endpoint: '/api/actresses',
      });
    }
  };
}
