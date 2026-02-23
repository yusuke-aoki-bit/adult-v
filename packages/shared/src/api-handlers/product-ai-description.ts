import { NextRequest, NextResponse } from 'next/server';

export interface ProductAiDescriptionHandlerDeps {
  getDb: () => any;
  products: any;
  eq: any;
}

export function createProductAiDescriptionHandler(deps: ProductAiDescriptionHandlerDeps) {
  return async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;
      const productId = parseInt(id);

      if (isNaN(productId)) {
        return NextResponse.json(null, { status: 404 });
      }

      const db = deps.getDb();
      const [product] = await db
        .select({
          aiDescription: deps.products.aiDescription,
          aiCatchphrase: deps.products.aiCatchphrase,
          aiShortDescription: deps.products.aiShortDescription,
        })
        .from(deps.products)
        .where(deps.eq(deps.products.id, productId))
        .limit(1);

      if (!product) {
        return NextResponse.json(null, { status: 404 });
      }

      // ai_description (jsonb) に完全なデータがある場合はそれを返す
      const desc = product.aiDescription as Record<string, unknown> | null;
      if (desc && typeof desc === 'object' && ('shortDescription' in desc || 'longDescription' in desc)) {
        return NextResponse.json(desc);
      }

      // 個別カラムからフォールバック構築
      if (product.aiCatchphrase || product.aiShortDescription) {
        return NextResponse.json({
          shortDescription: product.aiShortDescription || '',
          longDescription: '',
          catchphrase: product.aiCatchphrase || '',
          highlights: [],
          targetAudience: '',
        });
      }

      // データなし
      return NextResponse.json(null, { status: 404 });
    } catch {
      return NextResponse.json(null, { status: 404 });
    }
  };
}
