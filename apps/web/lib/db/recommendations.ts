/**
 * レコメンデーションDBクエリ
 * 共有パッケージのファクトリーを使用
 */
import { getDb } from './index';
import { products, productPerformers, productTags, productSources } from './schema';
import { createRecommendationsQueries } from '@adult-v/shared/db-queries';

// 共有クエリファクトリーでクエリを作成
const queries = createRecommendationsQueries({
  getDb: getDb as never,
  products,
  productPerformers,
  productTags,
  productSources,
});

// 関数をエクスポート
export const {
  getRelatedProducts,
  getWeeklyHighlights,
  getViewingPatternStats,
  getRecommendedActressesFromFavorites,
  getRelatedPerformers,
  getRelatedPerformersWithGenreMatch,
  getRelatedProductsByNames,
} = queries;

// 型エクスポート
export type {
  RelatedProductResult,
  WeeklyHighlights,
  ViewingPatternStats,
  RecommendedActress,
  RelatedPerformer,
  RelatedPerformerWithGenre,
} from '@adult-v/shared/db-queries';

// 以下は個別実装のまま（特殊なロジックがあるため）

import { products as productsTable, productPerformers as ppTable, productTags as ptTable } from './schema';
import { eq, and, inArray, ne, sql, desc } from 'drizzle-orm';

/**
 * Get performer's other products
 */
export async function getPerformerOtherProducts(performerId: number, currentProductId?: string, limit: number = 12) {
  const db = getDb();
  const currentProductIdNum = currentProductId ? (typeof currentProductId === 'string' ? parseInt(currentProductId) : currentProductId) : undefined;

  const query = db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      normalizedProductId: productsTable.normalizedProductId,
      releaseDate: productsTable.releaseDate,
      imageUrl: productsTable.defaultThumbnailUrl,
    })
    .from(productsTable)
    .innerJoin(ppTable, eq(productsTable.id, ppTable.productId))
    .where(
      currentProductIdNum
        ? and(
            eq(ppTable.performerId, performerId),
            ne(productsTable.id, currentProductIdNum)
          )
        : eq(ppTable.performerId, performerId)
    )
    .orderBy(desc(productsTable.releaseDate))
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
      id: productsTable.id,
      title: productsTable.title,
      normalizedProductId: productsTable.normalizedProductId,
      releaseDate: productsTable.releaseDate,
      imageUrl: productsTable.defaultThumbnailUrl,
    })
    .from(productsTable)
    .innerJoin(ptTable, eq(productsTable.id, ptTable.productId))
    .where(eq(ptTable.tagId, tagId))
    .orderBy(desc(productsTable.releaseDate))
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
      AND pv.viewed_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
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
    .select({ performerId: ppTable.performerId })
    .from(ppTable)
    .where(inArray(ppTable.productId, favoriteProductIds))
    .groupBy(ppTable.performerId);

  const favoriteTags = await db
    .select({ tagId: ptTable.tagId })
    .from(ptTable)
    .where(inArray(ptTable.productId, favoriteProductIds))
    .groupBy(ptTable.tagId);

  const performerIds = favoritePerformers.map((fp) => fp.performerId);
  const tagIds = favoriteTags.map((ft) => ft.tagId);

  let recommendations: Array<{
    id: number;
    title: string | null;
    normalizedProductId: string | null;
    releaseDate: string | null;
    imageUrl: string | null;
    matchScore: number;
    matchType: 'favorite_performer' | 'favorite_tag';
  }> = [];

  // Strategy 1: Products with favorite performers
  if (performerIds.length > 0) {
    const performerMatches = await db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        normalizedProductId: productsTable.normalizedProductId,
        releaseDate: productsTable.releaseDate,
        imageUrl: productsTable.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${ppTable.performerId})`.as('match_score'),
      })
      .from(productsTable)
      .innerJoin(ppTable, eq(productsTable.id, ppTable.productId))
      .where(
        and(
          inArray(ppTable.performerId, performerIds),
          sql`${productsTable.id} NOT IN (${sql.join(favoriteProductIds, sql`, `)})`
        )
      )
      .groupBy(productsTable.id, productsTable.title, productsTable.normalizedProductId, productsTable.releaseDate, productsTable.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(productsTable.releaseDate))
      .limit(limit);

    recommendations = performerMatches.map((p) => ({
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
        id: productsTable.id,
        title: productsTable.title,
        normalizedProductId: productsTable.normalizedProductId,
        releaseDate: productsTable.releaseDate,
        imageUrl: productsTable.defaultThumbnailUrl,
        matchScore: sql<number>`COUNT(DISTINCT ${ptTable.tagId})`.as('match_score'),
      })
      .from(productsTable)
      .innerJoin(ptTable, eq(productsTable.id, ptTable.productId))
      .where(
        and(
          inArray(ptTable.tagId, tagIds),
          sql`${productsTable.id} NOT IN (${sql.join(allExcludedIds, sql`, `)})`
        )
      )
      .groupBy(productsTable.id, productsTable.title, productsTable.normalizedProductId, productsTable.releaseDate, productsTable.defaultThumbnailUrl)
      .orderBy(desc(sql`match_score`), desc(productsTable.releaseDate))
      .limit(limit - recommendations.length);

    recommendations.push(
      ...tagMatches.map((p) => ({
        ...p,
        matchType: 'favorite_tag' as const,
      }))
    );
  }

  return recommendations.slice(0, limit);
}
