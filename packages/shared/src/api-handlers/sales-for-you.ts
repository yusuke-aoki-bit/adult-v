import { NextRequest, NextResponse } from 'next/server';
import { getDb, eq, and, inArray, desc, gt, sql } from '@adult-v/database';
import * as schema from '@adult-v/database/schema';

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
      ? favoritePerformerIdsParam
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : [];
    const recentProductIds = recentProductIdsParam ? recentProductIdsParam.split(',').filter(Boolean) : [];

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
        .innerJoin(schema.productSources, eq(schema.productSales.productSourceId, schema.productSources.id))
        .innerJoin(schema.products, eq(schema.productSources.productId, schema.products.id))
        .innerJoin(schema.productPerformers, eq(schema.products.id, schema.productPerformers.productId))
        .innerJoin(schema.performers, eq(schema.productPerformers.performerId, schema.performers.id))
        .where(
          and(
            eq(schema.productSales.isActive, true),
            inArray(schema.performers.id, favoritePerformerIds),
            sql`(${schema.productSales.endAt} IS NULL OR ${schema.productSales.endAt} > NOW())`,
            sql`${schema.productSales.fetchedAt} > NOW() - INTERVAL '14 days'`,
          ),
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
          .innerJoin(schema.productSources, eq(schema.productSales.productSourceId, schema.productSources.id))
          .innerJoin(schema.products, eq(schema.productSources.productId, schema.products.id))
          .innerJoin(schema.productPerformers, eq(schema.products.id, schema.productPerformers.productId))
          .innerJoin(schema.performers, eq(schema.productPerformers.performerId, schema.performers.id))
          .where(
            and(
              eq(schema.productSales.isActive, true),
              inArray(schema.performers.id, recentPerformerIds),
              sql`(${schema.productSales.endAt} IS NULL OR ${schema.productSales.endAt} > NOW())`,
              sql`${schema.productSales.fetchedAt} > NOW() - INTERVAL '14 days'`,
            ),
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
        .innerJoin(schema.productSources, eq(schema.productSales.productSourceId, schema.productSources.id))
        .innerJoin(schema.products, eq(schema.productSources.productId, schema.products.id))
        .where(
          and(
            eq(schema.productSales.isActive, true),
            gt(schema.productSales.discountPercent, 30),
            sql`(${schema.productSales.endAt} IS NULL OR ${schema.productSales.endAt} > NOW())`,
            sql`${schema.productSales.fetchedAt} > NOW() - INTERVAL '14 days'`,
          ),
        )
        .orderBy(desc(schema.productSales.discountPercent))
        .limit(limit - products.length + 5);

      // 重複除外して対象を絞り込み
      const trendingCandidates = trendingSales
        .filter((sale) => !addedProductIds.has(sale.id))
        .slice(0, limit - products.length);

      // バッチで女優情報を取得（N+1回避）
      const trendingProductIds = trendingCandidates.map((s) => s.id);
      const allPerformers =
        trendingProductIds.length > 0
          ? await db
              .select({
                productId: schema.productPerformers.productId,
                id: schema.performers.id,
                name: schema.performers.name,
              })
              .from(schema.productPerformers)
              .innerJoin(schema.performers, eq(schema.productPerformers.performerId, schema.performers.id))
              .where(inArray(schema.productPerformers.productId, trendingProductIds))
          : [];

      const performersByProduct = new Map<number, Array<{ id: number; name: string }>>();
      for (const p of allPerformers) {
        const arr = performersByProduct.get(p.productId) || [];
        if (arr.length < 3) arr.push({ id: p.id, name: p.name });
        performersByProduct.set(p.productId, arr);
      }

      for (const sale of trendingCandidates) {
        addedProductIds.add(sale.id);
        products.push({
          id: sale.id,
          normalizedProductId: sale.normalizedProductId,
          title: sale.title,
          thumbnailUrl: sale.thumbnailUrl,
          regularPrice: sale.regularPrice,
          salePrice: sale.salePrice,
          discountPercent: sale.discountPercent || 0,
          matchReason: 'trending',
          performers: performersByProduct.get(sale.id) || [],
          saleEndAt: sale.saleEndAt?.toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      products: products.slice(0, limit),
    });
  } catch (error) {
    console.error('Failed to fetch for-you sales:', error);
    return NextResponse.json({
      success: false,
      fallback: true,
      products: [],
    });
  }
}
