import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '../lib/llm-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * チャットボットAPI
 * 作品検索をサポートするAIアシスタント
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, availableGenres, popularPerformers } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 });
    }

    const response = await generateChatResponse({
      userMessage: message,
      conversationHistory,
      context: {
        availableGenres,
        popularPerformers,
      },
    });

    if (!response) {
      return NextResponse.json({ error: '応答の生成に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
