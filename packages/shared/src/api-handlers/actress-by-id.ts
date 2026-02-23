import { NextResponse } from 'next/server';
import { CACHE } from './constants/cache';
import { createApiErrorResponse } from '../lib/api-logger';

export interface ActressByIdHandlerDeps {
  getActressById: (id: string, locale?: string) => Promise<unknown | null>;
}

export function createActressByIdHandler(deps: ActressByIdHandlerDeps) {
  return async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json({ error: 'Actress ID is required' }, { status: 400 });
      }

      const actress = await deps.getActressById(id);

      if (!actress) {
        return NextResponse.json({ error: 'Actress not found' }, { status: 404 });
      }

      return NextResponse.json(actress, {
        headers: { 'Cache-Control': CACHE.ONE_DAY },
      });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch actress', 500, {
        endpoint: '/api/actresses/[id]',
      });
    }
  };
}
