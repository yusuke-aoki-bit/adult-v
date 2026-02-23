import { NextRequest, NextResponse } from 'next/server';

export interface ProductGenerateDescriptionHandlerDeps {
  getProductById: (id: string, locale: string) => Promise<any>;
  generateProductDescription: (params: {
    title: string;
    originalDescription?: string;
    performers?: string[];
    genres?: string[];
    maker?: string;
    duration?: number;
    releaseDate?: string;
    productCode?: string;
  }) => Promise<unknown>;
}

export function createProductGenerateDescriptionHandler(deps: ProductGenerateDescriptionHandlerDeps) {
  return async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;

      const product = await deps.getProductById(id, 'ja');

      if (!product) {
        return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });
      }

      const description = await deps.generateProductDescription({
        title: product.title,
        originalDescription: product.description || undefined,
        performers: product.performers?.map((p: any) => p.name),
        genres: product.tags,
        maker: product.providerLabel || undefined,
        duration: product.duration || undefined,
        releaseDate: product.releaseDate || undefined,
        productCode: product.makerProductCode || product.originalProductId || undefined,
      });

      if (!description) {
        return NextResponse.json({ error: '説明文の生成に失敗しました' }, { status: 500 });
      }

      return NextResponse.json(description);
    } catch (error) {
      console.error('[Generate Description API] Error:', error);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
  };
}
