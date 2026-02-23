import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from './constants/cache';
import { createApiErrorResponse } from '../lib/api-logger';

export interface DiscoverProduct {
  id: number;
  title: string;
  imageUrl: string;
  sampleImages: string[] | null;
  releaseDate: string | null;
  duration: number | null;
  price: number | null;
  provider: string | null;
  affiliateUrl: string | null;
  performers: string[];
  genres?: string[];
  maker?: string | null;
}

export interface DiscoverFilters {
  minDuration?: number;
  maxDuration?: number;
  minPrice?: number;
  maxPrice?: number;
  genres?: string[];
  performerIds?: number[];
  hasPerformer?: boolean;
  releasedAfter?: string;
}

export interface DiscoverHandlerDeps {
  getRandomProducts: (params: {
    excludeIds: number[];
    locale: string;
    filters?: DiscoverFilters;
    limit?: number;
  }) => Promise<DiscoverProduct[]>;
}

export function createDiscoverHandler(deps: DiscoverHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request['url']);

      const excludeIdsParam = searchParams.get('excludeIds');
      const excludeIds = excludeIdsParam
        ? excludeIdsParam
            .split(',')
            .map((id) => parseInt(id))
            .filter((id) => !isNaN(id))
        : [];
      const locale = searchParams.get('locale') || 'ja';

      // Parse filters
      const filters: DiscoverFilters = {};

      const minDuration = searchParams.get('minDuration');
      if (minDuration) filters.minDuration = parseInt(minDuration);

      const maxDuration = searchParams.get('maxDuration');
      if (maxDuration) filters.maxDuration = parseInt(maxDuration);

      const minPrice = searchParams.get('minPrice');
      if (minPrice) filters.minPrice = parseInt(minPrice);

      const maxPrice = searchParams.get('maxPrice');
      if (maxPrice) filters.maxPrice = parseInt(maxPrice);

      const genres = searchParams.get('genres');
      if (genres) filters.genres = genres.split(',');

      const performerIds = searchParams.get('performerIds');
      if (performerIds)
        filters.performerIds = performerIds
          .split(',')
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));

      const hasPerformer = searchParams.get('hasPerformer');
      if (hasPerformer !== null) filters.hasPerformer = hasPerformer === 'true';

      const releasedAfter = searchParams.get('releasedAfter');
      if (releasedAfter) filters.releasedAfter = releasedAfter;

      const limitParam = searchParams.get('limit');
      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam) || 6, 1), 20) : 6;

      const products = await deps.getRandomProducts({ excludeIds, locale, filters, limit });

      return NextResponse.json({ products }, { headers: { 'Cache-Control': CACHE.ONE_MIN } });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch product', 500, {
        endpoint: '/api/discover',
      });
    }
  };
}
