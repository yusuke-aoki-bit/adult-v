import { NextRequest, NextResponse } from 'next/server';
import { getDb, eq, desc } from '@adult-v/database';
import * as schema from '@adult-v/database/schema';

export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performerId = parseInt(id, 10);

    if (isNaN(performerId)) {
      return NextResponse.json({ error: 'Invalid performer ID' }, { status: 400 });
    }

    const db = getDb();

    // 女優の全作品と価格を取得
    const products = await db
      .select({
        id: schema.products.id,
        normalizedProductId: schema.products.normalizedProductId,
        title: schema.products.title,
        thumbnailUrl: schema.products.defaultThumbnailUrl,
        releaseDate: schema.products.releaseDate,
        price: schema.productSources.price,
        salePrice: schema.productSales.salePrice,
        isActiveSale: schema.productSales.isActive,
      })
      .from(schema.productPerformers)
      .innerJoin(
        schema.products,
        eq(schema.productPerformers.productId, schema.products.id)
      )
      .leftJoin(
        schema.productSources,
        eq(schema.products.id, schema.productSources.productId)
      )
      .leftJoin(
        schema.productSales,
        eq(schema.productSources.id, schema.productSales.productSourceId)
      )
      .where(eq(schema.productPerformers.performerId, performerId))
      .orderBy(desc(schema.products.releaseDate))
      .limit(100);

    // 重複を除去し、最低価格を選択
    const productMap = new Map<number, {
      id: number;
      normalizedProductId: string;
      title: string;
      thumbnailUrl: string | null;
      releaseDate: string;
      price: number;
      salePrice?: number;
    }>();

    for (const p of products) {
      const existing = productMap.get(p.id);
      const currentPrice = p.price || 0;
      const currentSalePrice = p.isActiveSale && p.salePrice ? p.salePrice : undefined;
      const effectivePrice = currentSalePrice || currentPrice;

      if (!existing || effectivePrice < (existing.salePrice || existing.price)) {
        productMap.set(p.id, {
          id: p.id,
          normalizedProductId: p.normalizedProductId,
          title: p.title,
          thumbnailUrl: p.thumbnailUrl,
          releaseDate: p.releaseDate?.toString() || '',
          price: currentPrice,
          salePrice: currentSalePrice,
        });
      }
    }

    const uniqueProducts = Array.from(productMap.values());

    // 合計金額を計算
    let totalRegularPrice = 0;
    let totalSalePrice = 0;
    let onSaleCount = 0;

    for (const p of uniqueProducts) {
      totalRegularPrice += p.price;
      if (p.salePrice && p.salePrice < p.price) {
        totalSalePrice += p.salePrice;
        onSaleCount++;
      } else {
        totalSalePrice += p.price;
      }
    }

    return NextResponse.json({
      totalProducts: uniqueProducts.length,
      products: uniqueProducts,
      totalRegularPrice,
      totalSalePrice,
      potentialSavings: totalRegularPrice - totalSalePrice,
      onSaleCount,
    });
  } catch (error) {
    console.error('Failed to calculate bundle:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bundle' },
      { status: 500 }
    );
  }
}
