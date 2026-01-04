import { NextRequest, NextResponse } from 'next/server';
import { logDbErrorAndReturn } from '../lib/db-logger';

export interface MakersHandlerDeps {
  getPopularMakers: (params?: {
    category?: 'maker' | 'label' | 'both';
    limit?: number;
    locale?: string;
  }) => Promise<unknown[]>;
  analyzeMakerPreference: (productIds: number[], locale?: string) => Promise<unknown[]>;
}

export function createMakersGetHandler(deps: MakersHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const category = searchParams.get('category') as 'maker' | 'label' | 'both' || 'both';
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const locale = searchParams.get('locale') || 'ja';

      const makers = await deps.getPopularMakers({
        category,
        limit,
        locale,
      });

      return NextResponse.json({ makers });
    } catch (error) {
      logDbErrorAndReturn(error, [], 'getPopularMakers');
      return NextResponse.json({ makers: [] }, { status: 500 });
    }
  };
}

export function createMakersPostHandler(deps: MakersHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      const { productIds, locale = 'ja' } = body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return NextResponse.json({ makers: [] });
      }

      const makers = await deps.analyzeMakerPreference(productIds, locale);

      return NextResponse.json({ makers });
    } catch (error) {
      logDbErrorAndReturn(error, [], 'analyzeMakerPreference');
      return NextResponse.json({ makers: [] }, { status: 500 });
    }
  };
}
