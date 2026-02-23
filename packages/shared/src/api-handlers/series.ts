import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

interface SeriesData {
  id: number;
  name: string;
  products: unknown[];
}

export interface SeriesHandlerDeps {
  getSeriesByTagId: (tagId: number, locale: string) => Promise<SeriesData | null>;
}

export function createSeriesHandler(deps: SeriesHandlerDeps) {
  return async function GET(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
    try {
      const { seriesId } = await params;
      const { searchParams } = new URL(request['url']);
      const locale = searchParams.get('locale') || 'ja';

      const tagId = parseInt(seriesId);
      if (isNaN(tagId)) {
        return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
      }

      const series = await deps.getSeriesByTagId(tagId, locale);

      return NextResponse.json({ series });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch series', 500, {
        endpoint: '/api/series/[seriesId]',
      });
    }
  };
}
