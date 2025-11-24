import { getDb } from './index';
import { products, productPerformers, productTags, tags } from './schema';
import { eq, and, inArray, ne, sql, desc } from 'drizzle-orm';

/**
 * Get related products based on performers, tags, and genre similarity
 */
export async function getRelatedProducts(productId: string, limit: number = 6) {
  const db = getDb();

  // Get the current product's performers and tags
  const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
  const currentProduct = await (db.query as any).products.findFirst({
    where: eq(products.id, productIdNum),
    with: {
      productPerformers: {
        with: {
          performer: true,
        },
      },
      productTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!currentProduct) {
    return [];
  }

  const performerIds = currentProduct.productPerformers.map((pp: any) => pp.performerId);
  const tagIds = currentProduct.productTags.map((pt: any) => pt.tagId);

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
