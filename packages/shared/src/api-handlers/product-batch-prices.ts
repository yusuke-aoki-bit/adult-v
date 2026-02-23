import { NextResponse } from 'next/server';

export interface ProductBatchPricesHandlerDeps {
  getDb: () => any;
  products: any;
  productSources: any;
  productSales: any;
  inArray: any;
  eq: any;
  and: any;
  sql: any;
}

export function createProductBatchPricesHandler(deps: ProductBatchPricesHandlerDeps) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { productIds } = body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return NextResponse.json({ error: 'productIds array is required' }, { status: 400 });
      }

      const limitedIds = productIds.slice(0, 100);
      const numericIds = limitedIds
        .map((id: any) => (typeof id === 'string' ? parseInt(id) : id))
        .filter((id: number) => !isNaN(id));

      if (numericIds.length === 0) {
        return NextResponse.json({});
      }

      const db = deps.getDb();

      const productRows = await db
        .select({ id: deps.products.id, duration: deps.products.duration })
        .from(deps.products)
        .where(deps.inArray(deps.products.id, numericIds));

      const durationMap = new Map(productRows.map((p: any) => [p.id, p.duration as number | null]));

      const sourceRows = await db
        .select({
          id: deps.productSources.id,
          productId: deps.productSources.productId,
          aspName: deps.productSources.aspName,
          price: deps.productSources.price,
        })
        .from(deps.productSources)
        .where(deps.inArray(deps.productSources.productId, numericIds));

      const sourceIds = sourceRows.map((s: any) => s.id);

      const saleRows: any[] =
        sourceIds.length > 0
          ? await db
              .select({
                productSourceId: deps.productSales.productSourceId,
                regularPrice: deps.productSales.regularPrice,
                salePrice: deps.productSales.salePrice,
                discountPercent: deps.productSales.discountPercent,
                endAt: deps.productSales.endAt,
              })
              .from(deps.productSales)
              .where(
                deps.and(
                  deps.inArray(deps.productSales.productSourceId, sourceIds),
                  deps.eq(deps.productSales.isActive, true),
                  deps.sql`${deps.productSales.fetchedAt} > NOW() - INTERVAL '14 days'`,
                ),
              )
          : [];

      const saleMap = new Map(saleRows.map((s: any) => [s.productSourceId, s]));

      const sourceByProduct = new Map<number, any>();
      for (const source of sourceRows) {
        const sale = saleMap.get(source.id);
        const effectivePrice = sale?.salePrice ?? source.price ?? Infinity;
        const existing = sourceByProduct.get(source.productId);
        const existingPrice = existing?.sale?.salePrice ?? existing?.price ?? Infinity;
        if (!existing || effectivePrice < existingPrice) {
          sourceByProduct.set(source.productId, { ...source, sale });
        }
      }

      const result: Record<string, any> = {};
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
  };
}
