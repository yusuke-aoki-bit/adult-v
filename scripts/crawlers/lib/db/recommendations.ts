import { getDb } from './index';
import { products, productPerformers, productTags } from './schema';
import { eq, and, inArray, ne, sql, desc } from 'drizzle-orm';

/**
 * Get related products based on performers, tags, and genre similarity
 */
export async function getRelatedProducts(productId: string, limit: number = 6) {
  const db = getDb();

  // Get the current product's performers and tags
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;

  // Check if product exists
  const currentProduct = await db
    .select()
    .from(products)
    .where(eq(products.id, productIdNum))
    .limit(1);

  if (currentProduct.length === 0) {
    return [];
  }

  // Get performers for this product
  const performerData = await db
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(eq(productPerformers.productId, productIdNum));

  // Get tags for this product
  const tagData = await db
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(eq(productTags.productId, productIdNum));

  const performerIds = performerData.map((pp) => pp.performerId);
  const tagIds = tagData.map((pt) => pt.tagId);

  // Strategy 1: Same performers (highest priority)
  let relatedProducts: any[] = [];

  if (performerIds.length > 0) {
    const samePerformerProducts = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        releaseDate: products.releaseDate,
        imageUrl: products.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${productPerformers.performerId})`.as('match_score'),
      })
      .from(products)
      .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
      .where(
        and(
          inArray(productPerformers.performerId, performerIds),
          ne(products.id, productIdNum)
        )
      )
      .groupBy(products.id, products.title, products.normalizedProductId, products.releaseDate, products.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(products.releaseDate))
      .limit(limit);

    relatedProducts = samePerformerProducts.map((p: any) => ({
      ...p,
      matchType: 'performer' as const,
    }));
  }

  // Strategy 2: Same tags (if we need more products)
  if (relatedProducts.length < limit && tagIds.length > 0) {
    const existingIds = relatedProducts.map((p) => p.id);

    const sameTagProducts = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        releaseDate: products.releaseDate,
        imageUrl: products.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${productTags.tagId})`.as('match_score'),
      })
      .from(products)
      .innerJoin(productTags, eq(products.id, productTags.productId))
      .where(
        and(
          inArray(productTags.tagId, tagIds),
          ne(products.id, productIdNum),
          existingIds.length > 0 ? sql`${products.id} NOT IN (${sql.join(existingIds, sql`, `)})` : sql`1=1`
        )
      )
      .groupBy(products.id, products.title, products.normalizedProductId, products.releaseDate, products.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(products.releaseDate))
      .limit(limit - relatedProducts.length);

    relatedProducts.push(
      ...sameTagProducts.map((p: any) => ({
        ...p,
        matchType: 'tag' as const,
      }))
    );
  }

  // Strategy 3: Recent products from same studio (if still need more)
  if (relatedProducts.length < limit) {
    const existingIds = relatedProducts.map((p) => p.id);

    const recentProducts = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        releaseDate: products.releaseDate,
        imageUrl: products.defaultThumbnailUrl,
      })
      .from(products)
      .where(
        and(
          ne(products.id, productIdNum),
          existingIds.length > 0 ? sql`${products.id} NOT IN (${sql.join(existingIds, sql`, `)})` : sql`1=1`
        )
      )
      .orderBy(desc(products.releaseDate))
      .limit(limit - relatedProducts.length);

    relatedProducts.push(
      ...recentProducts.map((p) => ({
        ...p,
        matchScore: 0,
        matchType: 'recent' as const,
      }))
    );
  }

  return relatedProducts.slice(0, limit);
}

/**
 * Get performer's other products
 */
export async function getPerformerOtherProducts(performerId: number, currentProductId?: string, limit: number = 12) {
  const db = getDb();

  // Convert string ID to number if provided
  const currentProductIdNum = currentProductId ? (typeof currentProductId === 'string' ? parseInt(currentProductId) : currentProductId) : undefined;

  const query = db
    .select({
      id: products.id,
      title: products.title,
      normalizedProductId: products.normalizedProductId,
      releaseDate: products.releaseDate,
      imageUrl: products.defaultThumbnailUrl,
    })
    .from(products)
    .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
    .where(
      currentProductIdNum
        ? and(
            eq(productPerformers.performerId, performerId),
            ne(products.id, currentProductIdNum)
          )
        : eq(productPerformers.performerId, performerId)
    )
    .orderBy(desc(products.releaseDate))
    .limit(limit);

  return await query;
}

/**
 * Get products by tag
 */
export async function getProductsByTag(tagId: number, limit: number = 20) {
  const db = getDb();

  const productsByTag = await db
    .select({
      id: products.id,
      title: products.title,
      normalizedProductId: products.normalizedProductId,
      releaseDate: products.releaseDate,
      imageUrl: products.defaultThumbnailUrl,
    })
    .from(products)
    .innerJoin(productTags, eq(products.id, productTags.productId))
    .where(eq(productTags.tagId, tagId))
    .orderBy(desc(products.releaseDate))
    .limit(limit);

  return productsByTag;
}

/**
 * Get trending products based on recent views
 */
export async function getTrendingProducts(limit: number = 20, days: number = 7) {
  const db = getDb();

  const trendingProducts = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.normalized_product_id as "normalizedProductId",
      p.release_date as "releaseDate",
      p.default_thumbnail_url as "imageUrl",
      COUNT(pv.id) as view_count
    FROM products p
    LEFT JOIN product_views pv ON p.id = pv.product_id
      AND pv.viewed_at >= NOW() - INTERVAL '1 day' * ${days}
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
    )
    GROUP BY p.id, p.title, p.normalized_product_id, p.release_date, p.default_thumbnail_url
    HAVING COUNT(pv.id) > 0
    ORDER BY view_count DESC, p.release_date DESC
    LIMIT ${limit}
  `);

  return trendingProducts.rows;
}

/**
 * Get personalized recommendations based on user's favorite items
 * (localStorage based, so this is a client-side utility function)
 */
export async function getRecommendationsFromFavorites(
  favoriteProductIds: number[],
  limit: number = 12
) {
  if (favoriteProductIds.length === 0) {
    return [];
  }

  const db = getDb();

  // Get performers and tags from favorite products
  const favoritePerformers = await db
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(inArray(productPerformers.productId, favoriteProductIds))
    .groupBy(productPerformers.performerId);

  const favoriteTags = await db
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(inArray(productTags.productId, favoriteProductIds))
    .groupBy(productTags.tagId);

  const performerIds = favoritePerformers.map((fp) => fp.performerId);
  const tagIds = favoriteTags.map((ft) => ft.tagId);

  let recommendations: any[] = [];

  // Strategy 1: Products with favorite performers
  if (performerIds.length > 0) {
    const performerMatches = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        releaseDate: products.releaseDate,
        imageUrl: products.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${productPerformers.performerId})`.as('match_score'),
      })
      .from(products)
      .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
      .where(
        and(
          inArray(productPerformers.performerId, performerIds),
          sql`${products.id} NOT IN (${sql.join(favoriteProductIds, sql`, `)})`
        )
      )
      .groupBy(products.id, products.title, products.normalizedProductId, products.releaseDate, products.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(products.releaseDate))
      .limit(limit);

    recommendations = performerMatches.map((p: any) => ({
      ...p,
      matchType: 'favorite_performer' as const,
    }));
  }

  // Strategy 2: Products with favorite tags (if need more)
  if (recommendations.length < limit && tagIds.length > 0) {
    const existingIds = recommendations.map((r) => r.id);
    const allExcludedIds = [...favoriteProductIds, ...existingIds];

    const tagMatches = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
        releaseDate: products.releaseDate,
        imageUrl: products.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${productTags.tagId})`.as('match_score'),
      })
      .from(products)
      .innerJoin(productTags, eq(products.id, productTags.productId))
      .where(
        and(
          inArray(productTags.tagId, tagIds),
          sql`${products.id} NOT IN (${sql.join(allExcludedIds, sql`, `)})`
        )
      )
      .groupBy(products.id, products.title, products.normalizedProductId, products.releaseDate, products.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(products.releaseDate))
      .limit(limit - recommendations.length);

    recommendations.push(
      ...tagMatches.map((p: any) => ({
        ...p,
        matchType: 'favorite_tag' as const,
      }))
    );
  }

  return recommendations.slice(0, limit);
}

/**
 * Get related performers based on shared tags/genres
 * Returns performers who share the most common tags with the given performer
 */
export async function getRelatedPerformers(performerId: number, limit: number = 6) {
  try {
    const db = getDb();

    // 同じ作品に出演している共演者を取得
    const coPerformers = await db.execute(sql`
      WITH performer_products AS (
        SELECT DISTINCT product_id
        FROM product_performers
        WHERE performer_id = ${performerId}
      ),
      co_performers AS (
        SELECT
          pp.performer_id,
          COUNT(DISTINCT pp.product_id) as shared_count
        FROM product_performers pp
        INNER JOIN performer_products prods ON pp.product_id = prods.product_id
        WHERE pp.performer_id != ${performerId}
        GROUP BY pp.performer_id
      )
      SELECT
        p.id,
        p.name,
        p.thumbnail_url as "thumbnailUrl",
        p.hero_image_url as "heroImageUrl",
        cp.shared_count as "sharedCount",
        (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount"
      FROM performers p
      INNER JOIN co_performers cp ON p.id = cp.performer_id
      ORDER BY cp.shared_count DESC, p.name ASC
      LIMIT ${limit}
    `);

    return coPerformers.rows as Array<{
      id: number;
      name: string;
      thumbnailUrl: string | null;
      heroImageUrl: string | null;
      sharedCount: number;
      productCount: number;
    }>;
  } catch {
    // クエリエラー時は空配列を返す（共演者データがない場合など）
    return [];
  }
}
