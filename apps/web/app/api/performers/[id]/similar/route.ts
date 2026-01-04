import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';
import { createPerformerSimilarHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ
export const runtime = 'nodejs';

const handler = createPerformerSimilarHandler(
  {
    getDb: getDb as Parameters<typeof createPerformerSimilarHandler>[0]['getDb'],
    performers,
    getCache,
    setCache,
    generateCacheKey,
    aspName: 'mgs',
  },
  { siteMode: 'mgs' } // webはMGS（全ソース）
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const performerId = parseInt(id, 10);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const result = await handler(performerId, limit);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
