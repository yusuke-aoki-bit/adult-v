import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources, productSales } from '@/lib/db/schema';
import { inArray, eq, and } from 'drizzle-orm';

/**
 * 複数商品の価格情報をバッチ取得
 * POST /api/products/prices
 * Body: { productIds: string[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array is required' },
        { status: 400 }
      );
    }

    // Limit to 100 products per request
    const limitedIds = productIds.slice(0, 100);
    const numericIds = limitedIds
      .map(id => typeof id === 'string' ? parseInt(id) : id)
      .filter(id => !isNaN(id));

    if (numericIds.length === 0) {
      return NextResponse.json({});
    }

    const db = getDb();

    // Fetch product base info with duration
    const productRows = await db
      .select({
        id: products.id,
        duration: products.duration,
      })
      .from(products)
      .where(inArray(products.id, numericIds));

    // Create product duration map
    const durationMap = new Map(productRows.map(p => [p.id, p.duration as number | null]));

    // Fetch source info (price and provider) for each product
    const sourceRows = await db
      .select({
        id: productSources.id,
        productId: productSources.productId,
        aspName: productSources.aspName,
        price: productSources.price,
      })
      .from(productSources)
      .where(inArray(productSources.productId, numericIds));

    // Get all source IDs to fetch sale info
    const sourceIds = sourceRows.map(s => s.id);

    // Fetch active sale info
    const saleRows = sourceIds.length > 0 ? await db
      .select({
        productSourceId: productSales.productSourceId,
        regularPrice: productSales.regularPrice,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .where(and(
        inArray(productSales.productSourceId, sourceIds),
        eq(productSales.isActive, true)
      )) : [];

    // Create sale map (productSourceId -> sale)
    const saleMap = new Map(saleRows.map(s => [s.productSourceId, s]));

    // Group sources by productId, taking the first one with the lowest price
    const sourceByProduct = new Map<number, typeof sourceRows[0] & { sale?: typeof saleRows[0] }>();
    for (const source of sourceRows) {
      const sale = saleMap.get(source.id);
      const effectivePrice = sale?.salePrice ?? source.price ?? Infinity;
      const existing = sourceByProduct.get(source.productId);
      const existingPrice = existing?.sale?.salePrice ?? existing?.price ?? Infinity;

      if (!existing || effectivePrice < existingPrice) {
        sourceByProduct.set(source.productId, { ...source, sale });
      }
    }

    // Build result object
    const result: Record<string, {
      price: number | null;
      salePrice: number | null;
      discount: number | null;
      saleEndDate: string | null;
      provider: string | null;
      duration: number | null;
    }> = {};

    for (const productId of numericIds) {
      const source = sourceByProduct.get(productId);
      const duration = durationMap.get(productId) ?? null;

      if (source) {
        result[String(productId)] = {
          price: source.sale?.regularPrice ?? source.price ?? null,
          salePrice: source.sale?.salePrice ?? null,
          discount: source.sale?.discountPercent ?? null,
          saleEndDate: source.sale?.endAt ? source.sale.endAt.toISOString() : null,
          provider: source.aspName,
          duration,
        };
      } else {
        result[String(productId)] = {
          price: null,
          salePrice: null,
          discount: null,
          saleEndDate: null,
          provider: null,
          duration,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching product prices:', error);
    return NextResponse.json({ fallback: true });
  }
}
