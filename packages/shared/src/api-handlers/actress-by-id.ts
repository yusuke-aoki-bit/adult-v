import { NextResponse } from 'next/server';

// Individual actress data rarely changes - cache 24 hours
const CACHE_24_HOURS = 'public, s-maxage=86400, stale-while-revalidate=604800';

export interface ActressByIdHandlerDeps {
  getActressById: (id: string, locale?: string) => Promise<unknown | null>;
}

export function createActressByIdHandler(deps: ActressByIdHandlerDeps) {
  return async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json(
          { error: 'Actress ID is required' },
          { status: 400 }
        );
      }

      const actress = await deps.getActressById(id);

      if (!actress) {
        return NextResponse.json(
          { error: 'Actress not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(actress, {
        headers: { 'Cache-Control': CACHE_24_HOURS }
      });
    } catch (error) {
      console.error('Error fetching actress:', error);
      return NextResponse.json(
        { error: 'Failed to fetch actress' },
        { status: 500 }
      );
    }
  };
}
