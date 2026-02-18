import { NextRequest, NextResponse } from 'next/server';
import { getDb, eq, and, inArray, desc, gt } from '@adult-v/database';
import * as schema from '@adult-v/database/schema';

export const revalidate = 300;

interface ForYouProduct {
  id: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  matchReason: 'favorite_actress' | 'recently_viewed' | 'genre_match' | 'trending';
  matchDetails?: string;
  performers: Array<{ id: number; name: string }>;
  saleEndAt?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const favoritePerformerIdsParam = searchParams.get('favoritePerformerIds');
    const recentProductIdsParam = searchParams.get('recentProductIds');
    const limit = parseInt(searchParams.get('limit') || '8', 10);

    const favoritePerformerIds = favoritePerformerIdsParam
      ? favoritePerformerIdsParam.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
      : [];
    const recentProductIds = recentProductIdsParam
      ? recentProductIdsParam.split(',').filter(Boolean)
      : [];

    const db = getDb();
    const products: ForYouProduct[] = [];
    const addedProductIds = new Set<number>();

    // 1. お気に入り女優のセール作品を取得
    if (favoritePerformerIds.length > 0) {
      const favoriteActressSales = await db
        .select({
          id: schema.products.id,
          normalizedProductId: schema.products.normalizedProductId,
          title: schema.products.title,
          thumbnailUrl: schema.products.defaultThumbnailUrl,
          regularPrice: schema.productSales.regularPrice,
          salePrice: schema.productSales.salePrice,
          discountPercent: schema.productSales.discountPercent,
          saleEndAt: schema.productSales.endAt,
          performerId: schema.performers.id,
          performerName: schema.performers.name,
        })
        .from(schema.productSales)
        .innerJoin(
          schema.productSources,
          eq(schema.productSales.productSourceId, schema.productSources.id)
        )
        .innerJoin(
          schema.products,
          eq(schema.productSources.productId, schema.products.id)
        )
        .innerJoin(
          schema.productPerformers,
          eq(schema.products.id, schema.productPerformers.productId)
        )
        .innerJoin(
          schema.performers,
          eq(schema.productPerformers.performerId, schema.performers.id)
        )
        .where(
          and(
            eq(schema.productSales.isActive, true),
            inArray(schema.performers.id, favoritePerformerIds),
            gt(schema.productSales.endAt, new Date())
          )
        )
        .orderBy(desc(schema.productSales.discountPercent))
        .limit(limit);

      for (const sale of favoriteActressSales) {
        if (!addedProductIds.has(sale.id)) {
          addedProductIds.add(sale.id);
          products.push({
            id: sale.id,
            normalizedProductId: sale.normalizedProductId,
            title: sale.title,
            thumbnailUrl: sale.thumbnailUrl,
            regularPrice: sale.regularPrice,
            salePrice: sale.salePrice,
            discountPercent: sale.discountPercent || 0,
            matchReason: 'favorite_actress',
            matchDetails: sale.performerName,
            performers: [{ id: sale.performerId, name: sale.performerName }],
            saleEndAt: sale.saleEndAt?.toISOString(),
          });
        }
      }
    }

    // 2. 最近見た作品に関連するセール作品（同じ女優）を取得
    if (recentProductIds.length > 0 && products.length < limit) {
      // 最近見た作品の女優を取得
      const recentPerformers = await db
        .selectDistinct({ performerId: schema.productPerformers.performerId })
        .from(schema.productPerformers)
        .innerJoin(schema.products, eq(schema.productPerformers.productId, schema.products.id))
        .where(inArray(schema.products.normalizedProductId, recentProductIds))
        .limit(10);

      const recentPerformerIds = recentPerformers.map((p) => p.performerId);

      if (recentPerformerIds.length > 0) {
        const relatedSales = await db
          .select({
            id: schema.products.id,
            normalizedProductId: schema.products.normalizedProductId,
            title: schema.products.title,
            thumbnailUrl: schema.products.defaultThumbnailUrl,
            regularPrice: schema.productSales.regularPrice,
            salePrice: schema.productSales.salePrice,
            discountPercent: schema.productSales.discountPercent,
            saleEndAt: schema.productSales.endAt,
            performerId: schema.performers.id,
            performerName: schema.performers.name,
          })
          .from(schema.productSales)
          .innerJoin(
            schema.productSources,
            eq(schema.productSales.productSourceId, schema.productSources.id)
          )
          .innerJoin(
            schema.products,
            eq(schema.productSources.productId, schema.products.id)
          )
          .innerJoin(
            schema.productPerformers,
            eq(schema.products.id, schema.productPerformers.productId)
          )
          .innerJoin(
            schema.performers,
            eq(schema.productPerformers.performerId, schema.performers.id)
          )
          .where(
            and(
              eq(schema.productSales.isActive, true),
              inArray(schema.performers.id, recentPerformerIds),
              gt(schema.productSales.endAt, new Date())
            )
          )
          .orderBy(desc(schema.productSales.discountPercent))
          .limit(limit - products.length);

        for (const sale of relatedSales) {
          if (!addedProductIds.has(sale.id)) {
            addedProductIds.add(sale.id);
            products.push({
              id: sale.id,
              normalizedProductId: sale.normalizedProductId,
              title: sale.title,
              thumbnailUrl: sale.thumbnailUrl,
              regularPrice: sale.regularPrice,
              salePrice: sale.salePrice,
              discountPercent: sale.discountPercent || 0,
              matchReason: 'recently_viewed',
              matchDetails: sale.performerName,
              performers: [{ id: sale.performerId, name: sale.performerName }],
              saleEndAt: sale.saleEndAt?.toISOString(),
            });
          }
        }
      }
    }

    // 3. 人気のセール作品で埋める
    if (products.length < limit) {
      const trendingSales = await db
        .select({
          id: schema.products.id,
          normalizedProductId: schema.products.normalizedProductId,
          title: schema.products.title,
          thumbnailUrl: schema.products.defaultThumbnailUrl,
          regularPrice: schema.productSales.regularPrice,
          salePrice: schema.productSales.salePrice,
          discountPercent: schema.productSales.discountPercent,
          saleEndAt: schema.productSales.endAt,
        })
        .from(schema.productSales)
        .innerJoin(
          schema.productSources,
          eq(schema.productSales.productSourceId, schema.productSources.id)
        )
        .innerJoin(
          schema.products,
          eq(schema.productSources.productId, schema.products.id)
        )
        .where(
          and(
            eq(schema.productSales.isActive, true),
            gt(schema.productSales.discountPercent, 30),
            gt(schema.productSales.endAt, new Date())
          )
        )
        .orderBy(desc(schema.productSales.discountPercent))
        .limit(limit - products.length + 5);

      for (const sale of trendingSales) {
        if (!addedProductIds.has(sale.id) && products.length < limit) {
          addedProductIds.add(sale.id);

          // 女優情報を取得
          const performers = await db
            .select({
              id: schema.performers.id,
              name: schema.performers.name,
            })
            .from(schema.productPerformers)
            .innerJoin(schema.performers, eq(schema.productPerformers.performerId, schema.performers.id))
            .where(eq(schema.productPerformers.productId, sale.id))
            .limit(3);

          products.push({
            id: sale.id,
            normalizedProductId: sale.normalizedProductId,
            title: sale.title,
            thumbnailUrl: sale.thumbnailUrl,
            regularPrice: sale.regularPrice,
            salePrice: sale.salePrice,
            discountPercent: sale.discountPercent || 0,
            matchReason: 'trending',
            performers,
            saleEndAt: sale.saleEndAt?.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      products: products.slice(0, limit),
    });
  } catch (error) {
    console.error('Failed to fetch for-you sales:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales', products: [] },
      { status: 500 }
    );
  }
}
