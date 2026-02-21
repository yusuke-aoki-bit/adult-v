import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@adult-v/database';
import { createPriceHistoryQueries } from '@adult-v/shared/db-queries/price-history';

const priceHistoryQueries = createPriceHistoryQueries(getDb);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const aspName = searchParams.get('asp') || undefined;
    const limit = parseInt(searchParams.get('limit') || '90', 10);
    const daysBack = parseInt(searchParams.get('days') || '365', 10);

    // 価格履歴を取得
    const history = await priceHistoryQueries.getPriceHistoryByProductId(id, {
      limit,
      daysBack,
      aspName,
    });

    // 統計情報を取得
    const stats = await priceHistoryQueries.getPriceStats(id, aspName);

    return NextResponse.json({
      success: true,
      history,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch price history:', error);
    return NextResponse.json({
      success: false,
      fallback: true,
      history: [],
      stats: null,
    });
  }
}
