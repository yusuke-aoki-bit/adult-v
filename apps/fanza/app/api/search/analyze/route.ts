import { NextRequest, NextResponse } from 'next/server';
import { analyzeSearchQuery } from '@adult-v/shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 検索クエリ分析API
 * ユーザーの検索クエリを解析し、意図を理解して拡張クエリを返す
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, availableGenres, popularPerformers } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      );
    }

    const analysis = await analyzeSearchQuery(query, {
      availableGenres,
      popularPerformers,
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'クエリ分析に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[Search Analyze API] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
