import { NextResponse } from 'next/server';

/**
 * 商品の価格情報を取得（複数ASP対応）
 * 現在はproductCacheテーブルが未実装のため、空配列を返す
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    // productCacheテーブルが未実装のため、空配列を返す
    // TODO: 複数ASP価格比較機能が実装されたら、ここでDBから取得する
    return NextResponse.json({ prices: [] });
  } catch (error) {
    console.error('Error fetching product prices:', error);
    return NextResponse.json({ prices: [], fallback: true });
  }
}
