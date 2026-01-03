import { NextRequest, NextResponse } from 'next/server';
import { generateProductDescription } from '@adult-v/shared';
import { getProductById } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 商品説明自動生成API
 * 商品IDから情報を取得し、AIで説明文を生成
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 商品情報を取得
    const product = await getProductById(id, 'ja');

    if (!product) {
      return NextResponse.json(
        { error: '商品が見つかりません' },
        { status: 404 }
      );
    }

    // 説明文を生成
    const description = await generateProductDescription({
      title: product.title,
      originalDescription: product.description || undefined,
      performers: product.performers?.map(p => p.name),
      genres: product.tags,
      maker: product.providerLabel || undefined,
      duration: product.duration || undefined,
      releaseDate: product.releaseDate || undefined,
      productCode: product.makerProductCode || product.originalProductId || undefined,
    });

    if (!description) {
      return NextResponse.json(
        { error: '説明文の生成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(description);
  } catch (error) {
    console.error('[Generate Description API] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
