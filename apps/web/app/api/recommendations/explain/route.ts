import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendationExplanation } from '@adult-v/shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * レコメンド理由生成API
 * なぜこの作品をおすすめするのかの説明を生成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalProduct, recommendedProduct } = body;

    if (!originalProduct || !recommendedProduct) {
      return NextResponse.json(
        { error: '元の作品とおすすめ作品の情報が必要です' },
        { status: 400 }
      );
    }

    if (!originalProduct.title || !recommendedProduct.title) {
      return NextResponse.json(
        { error: '作品タイトルが必要です' },
        { status: 400 }
      );
    }

    const explanation = await generateRecommendationExplanation({
      originalProduct: {
        title: originalProduct.title,
        performers: originalProduct.performers,
        genres: originalProduct.genres,
      },
      recommendedProduct: {
        title: recommendedProduct.title,
        performers: recommendedProduct.performers,
        genres: recommendedProduct.genres,
      },
    });

    if (!explanation) {
      return NextResponse.json(
        { error: '説明の生成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(explanation);
  } catch (error) {
    console.error('[Recommendation Explain API] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
