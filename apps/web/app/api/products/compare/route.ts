import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources, productPerformers, performers, productTags, tags, productSales, productRatingSummary } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 60 * 10; // 10分

interface CompareProduct {
  id: number;
  normalizedProductId: string;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  duration: number | null;
  performers: string[];
  tags: string[];
  sources: Array<{
    aspName: string;
    price: number | null;
    salePrice: number | null;
    discountPercent: number | null;
    affiliateUrl: string;
  }>;
  rating: {
    average: number | null;
    count: number;
  };
}

/**
 * 作品比較API
 * GET /api/products/compare?ids=id1,id2,id3
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json(
        { error: 'Product IDs are required' },
        { status: 400 }
      );
    }

    const idsInput = idsParam.split(',').slice(0, 4); // 最大4件

    if (idsInput.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 products are required for comparison' },
        { status: 400 }
      );
    }

    // 数値IDかnormalizedProductIdかを判定
    const isNumericIds = idsInput.every(id => /^\d+$/.test(id));
    const numericIds = isNumericIds ? idsInput.map(id => parseInt(id, 10)) : [];

    // キャッシュチェック
    const cacheKey = generateCacheKey('compare:web', { ids: idsInput.sort().join(',') });
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const db = getDb();

    // 作品基本情報を取得（数値IDまたはnormalizedProductIdで検索）
    const productsData = await db
      .select({
        id: products.id,
        normalizedProductId: products.normalizedProductId,
        title: products.title,
        imageUrl: products.defaultThumbnailUrl,
        releaseDate: products.releaseDate,
        duration: products.duration,
      })
      .from(products)
      .where(
        isNumericIds
          ? inArray(products.id, numericIds)
          : inArray(products.normalizedProductId, idsInput)
      );

    if (productsData.length === 0) {
      return NextResponse.json(
        { error: 'No products found' },
        { status: 404 }
      );
    }

    const productIds = productsData.map(p => p.id);

    // 出演者を取得
    const performersData = await db
      .select({
        productId: productPerformers.productId,
        performerName: performers.name,
      })
      .from(productPerformers)
      .innerJoin(performers, sql`${productPerformers.performerId} = ${performers.id}`)
      .where(inArray(productPerformers.productId, productIds));

    const performersByProduct = new Map<number, string[]>();
    for (const p of performersData) {
      if (!performersByProduct.has(p.productId)) {
        performersByProduct.set(p.productId, []);
      }
      performersByProduct.get(p.productId)!.push(p.performerName);
    }

    // タグを取得
    const tagsData = await db
      .select({
        productId: productTags.productId,
        tagName: tags.name,
      })
      .from(productTags)
      .innerJoin(tags, sql`${productTags.tagId} = ${tags.id}`)
      .where(inArray(productTags.productId, productIds));

    const tagsByProduct = new Map<number, string[]>();
    for (const t of tagsData) {
      if (!tagsByProduct.has(t.productId)) {
        tagsByProduct.set(t.productId, []);
      }
      tagsByProduct.get(t.productId)!.push(t.tagName);
    }

    // ソース情報（価格含む）を取得
    const sourcesData = await db
      .select({
        productId: productSources.productId,
        aspName: productSources.aspName,
        price: productSources.price,
        affiliateUrl: productSources.affiliateUrl,
      })
      .from(productSources)
      .where(inArray(productSources.productId, productIds));

    // セール情報を取得
    const salesResult = await db
      .select({
        productId: productSources.productId,
        aspName: productSources.aspName,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
      })
      .from(productSources)
      .innerJoin(productSales, sql`${productSources.id} = ${productSales.productSourceId}`)
      .where(
        sql`${inArray(productSources.productId, productIds)}
          AND ${productSales.isActive} = true
          AND (${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`
      );

    const salesByProductAsp = new Map<string, { salePrice: number; discountPercent: number | null }>();
    for (const sale of salesResult) {
      salesByProductAsp.set(`${sale.productId}-${sale.aspName}`, {
        salePrice: sale.salePrice,
        discountPercent: sale.discountPercent,
      });
    }

    const sourcesByProduct = new Map<number, CompareProduct['sources']>();
    for (const s of sourcesData) {
      if (!sourcesByProduct.has(s.productId)) {
        sourcesByProduct.set(s.productId, []);
      }
      const saleInfo = salesByProductAsp.get(`${s.productId}-${s.aspName}`);
      sourcesByProduct.get(s.productId)!.push({
        aspName: s.aspName,
        price: s.price,
        salePrice: saleInfo?.salePrice || null,
        discountPercent: saleInfo?.discountPercent || null,
        affiliateUrl: s.affiliateUrl,
      });
    }

    // 評価情報を取得
    const ratingsData = await db
      .select({
        productId: productRatingSummary.productId,
        averageRating: productRatingSummary.averageRating,
        totalReviews: productRatingSummary.totalReviews,
      })
      .from(productRatingSummary)
      .where(inArray(productRatingSummary.productId, productIds));

    const ratingsByProduct = new Map<number, { average: number | null; count: number }>();
    for (const r of ratingsData) {
      const existing = ratingsByProduct.get(r.productId);
      const avgRating = r.averageRating ? parseFloat(r.averageRating) : null;
      const reviews = r.totalReviews || 0;

      if (!existing) {
        ratingsByProduct.set(r.productId, { average: avgRating, count: reviews });
      } else {
        // 複数ASPからの評価を平均
        if (avgRating !== null) {
          if (existing.average === null) {
            existing.average = avgRating;
          } else {
            existing.average = (existing.average + avgRating) / 2;
          }
        }
        existing.count += reviews;
      }
    }

    // 結果を組み立て
    const compareProducts: CompareProduct[] = productsData.map(p => ({
      id: p.id,
      normalizedProductId: p.normalizedProductId,
      title: p.title,
      imageUrl: p.imageUrl,
      releaseDate: p.releaseDate,
      duration: p.duration,
      performers: performersByProduct.get(p.id) || [],
      tags: tagsByProduct.get(p.id) || [],
      sources: sourcesByProduct.get(p.id) || [],
      rating: ratingsByProduct.get(p.id) || { average: null, count: 0 },
    }));

    // リクエストされた順序で並べ替え
    const orderedProducts = idsInput
      .map(id => {
        if (isNumericIds) {
          return compareProducts.find(p => p.id === parseInt(id, 10));
        }
        return compareProducts.find(p => p.normalizedProductId === id);
      })
      .filter((p): p is CompareProduct => p !== undefined);

    // 共通タグと共通出演者を計算
    const allTags = orderedProducts.map(p => new Set(p.tags));
    const commonTags = allTags.reduce((acc, set) =>
      new Set([...acc].filter(x => set.has(x)))
    );

    const allPerformers = orderedProducts.map(p => new Set(p.performers));
    const commonPerformers = allPerformers.reduce((acc, set) =>
      new Set([...acc].filter(x => set.has(x)))
    );

    const response = {
      success: true,
      products: orderedProducts,
      comparison: {
        commonTags: Array.from(commonTags),
        commonPerformers: Array.from(commonPerformers),
        priceRange: {
          min: Math.min(...orderedProducts.flatMap(p =>
            p.sources.map(s => s.salePrice || s.price || Infinity)
          ).filter(p => p !== Infinity)),
          max: Math.max(...orderedProducts.flatMap(p =>
            p.sources.map(s => s.price || 0)
          )),
        },
      },
    };

    // キャッシュに保存
    await setCache(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Compare API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
