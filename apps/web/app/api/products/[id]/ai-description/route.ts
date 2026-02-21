import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const revalidate = 3600;

/**
 * 商品のAI生成説明を取得
 * GET /api/products/[id]/ai-description
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(null, { status: 404 });
    }

    const db = getDb();
    const [product] = await db
      .select({
        aiDescription: products.aiDescription,
        aiCatchphrase: products.aiCatchphrase,
        aiShortDescription: products.aiShortDescription,
      })
      .from(products)
      .where(eq(products.id, productId))
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
}
