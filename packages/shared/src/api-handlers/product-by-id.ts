import { NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

export interface ProductByIdHandlerDeps {
  /** 数値IDで商品を取得 */
  getProductById: (id: string, locale?: string) => Promise<unknown | null>;
  /** 品番(normalizedProductId)で商品を検索（オプション） */
  searchProductByProductId?: (productId: string, locale?: string) => Promise<unknown | null>;
}

export function createProductByIdHandler(deps: ProductByIdHandlerDeps) {
  return async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json(
          { error: 'Product ID is required' },
          { status: 400 }
        );
      }

      // localeパラメータを取得
      const url = new URL(request.url);
      const locale = url.searchParams.get('hl') || url.searchParams.get('locale') || 'ja';

      let product = null;

      // まず品番検索を試行（searchProductByProductIdが提供されている場合）
      if (deps.searchProductByProductId) {
        product = await deps.searchProductByProductId(id, locale);
      }

      // 見つからない場合、数値IDとして検索
      if (!product && !isNaN(parseInt(id))) {
        product = await deps.getProductById(id, locale);
      }

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(product);
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch product', 500, {
        endpoint: '/api/products/[id]',
      });
    }
  };
}
