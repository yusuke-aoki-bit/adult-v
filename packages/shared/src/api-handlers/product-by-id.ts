import { NextResponse } from 'next/server';

export interface ProductByIdHandlerDeps {
  getProductById: (id: string, locale?: string) => Promise<unknown | null>;
}

export function createProductByIdHandler(deps: ProductByIdHandlerDeps) {
  return async function GET(
    _request: Request,
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

      const product = await deps.getProductById(id);

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      );
    }
  };
}
