import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';
import { createProductSimilarHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = createProductSimilarHandler(
  {
    getDb: getDb as Parameters<typeof createProductSimilarHandler>[0]['getDb'],
    products,
    getCache,
    setCache,
    generateCacheKey,
    aspName: 'mgs',
  },
  { siteMode: 'mgs' }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id, 10);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '12', 10);

  const result = await handler(productId, limit);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
