import { NextResponse } from 'next/server';

export interface ProductSearchByIdHandlerDeps {
  searchProductByProductId: (productId: string) => Promise<unknown>;
}

export function createProductSearchByIdHandler(deps: ProductSearchByIdHandlerDeps) {
  return async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const productId = searchParams.get('productId');

      if (!productId) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
      }

      const product = await deps.searchProductByProductId(productId);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ product });
    } catch (error) {
      console.error('Error searching product by ID:', error);
      return NextResponse.json({ product: null, fallback: true });
    }
  };
}
