import { getDb } from './index';
import { products, productPerformers, productTags, productSources } from './schema';
import { eq, and, inArray, ne, sql, desc } from 'drizzle-orm';

/**
 * Get related products based on performers, tags, and genre similarity
 * @param productId - The product ID to find related products for
 * @param limit - Maximum number of products to return
 * @param aspName - Optional ASP name to filter by (e.g., 'fanza')
 */
export async function getRelatedProducts(productId: string, limit: number = 6, aspName?: string) {
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

  // ASPフィルター条件を作成
  const aspFilterCondition = aspName
    ? sql`EXISTS (SELECT 1 FROM ${productSources} ps WHERE ps.product_id = ${products.id} AND LOWER(ps.asp_name) = ${aspName.toLowerCase()})`
    : sql`1=1`;

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
          ne(products.id, productIdNum),
          aspFilterCondition
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
          existingIds.length > 0 ? sql`${products.id} NOT IN (${sql.join(existingIds, sql`, `)})` : sql`1=1`,
          aspFilterCondition
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
          existingIds.length > 0 ? sql`${products.id} NOT IN (${sql.join(existingIds, sql`, `)})` : sql`1=1`,
          aspFilterCondition
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
 * Get related products based on performer names and tag names
 * Used for "Viewers also watched" feature
 */
export async function getRelatedProductsByNames(options: {
  performers: string[];
  tags: string[];
  excludeProductId?: string;
  limit?: number;
}) {
  const { performers = [], tags = [], excludeProductId, limit = 6 } = options;
  const db = getDb();

  const excludeId = excludeProductId ? parseInt(excludeProductId, 10) : null;

  // Build performer IDs from names
  let performerIds: number[] = [];
  if (performers.length > 0) {
    const performerResults = await db.execute(sql`
      SELECT id FROM performers WHERE name IN (${sql.join(performers.map(p => sql`${p}`), sql`, `)})
    `);
    performerIds = (performerResults.rows as any[]).map(r => r.id);
  }

  // Build tag IDs from names
  let tagIds: number[] = [];
  if (tags.length > 0) {
    const tagResults = await db.execute(sql`
      SELECT id FROM tags WHERE name IN (${sql.join(tags.map(t => sql`${t}`), sql`, `)})
    `);
    tagIds = (tagResults.rows as any[]).map(r => r.id);
  }

  let relatedProducts: any[] = [];

  // Strategy 1: Same performers
  if (performerIds.length > 0) {
    const excludeClause = excludeId ? sql`AND p.id != ${excludeId}` : sql``;
    const samePerformerProducts = await db.execute(sql`
      SELECT
        p.id,
        p.title,
        p.normalized_product_id as "normalizedProductId",
        p.default_thumbnail_url as "imageUrl",
        COUNT(DISTINCT pp.performer_id) as match_score
      FROM products p
      INNER JOIN product_performers pp ON p.id = pp.product_id
      WHERE pp.performer_id IN (${sql.join(performerIds.map(id => sql`${id}`), sql`, `)})
        ${excludeClause}
      GROUP BY p.id, p.title, p.normalized_product_id, p.default_thumbnail_url
      ORDER BY match_score DESC, p.release_date DESC
      LIMIT ${limit}
    `);

    relatedProducts = (samePerformerProducts.rows as any[]).map(p => ({
      ...p,
      matchType: 'performer',
      performers: [],
      tags: [],
    }));
  }

  // Strategy 2: Same tags (if we need more)
  if (relatedProducts.length < limit && tagIds.length > 0) {
    const existingIds = relatedProducts.map(p => p.id);
    const excludeClause = excludeId ? sql`AND p.id != ${excludeId}` : sql``;
    const existingClause = existingIds.length > 0
      ? sql`AND p.id NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})`
      : sql``;

    const sameTagProducts = await db.execute(sql`
      SELECT
        p.id,
        p.title,
        p.normalized_product_id as "normalizedProductId",
        p.default_thumbnail_url as "imageUrl",
        COUNT(DISTINCT pt.tag_id) as match_score
      FROM products p
      INNER JOIN product_tags pt ON p.id = pt.product_id
      WHERE pt.tag_id IN (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})
        ${excludeClause}
        ${existingClause}
      GROUP BY p.id, p.title, p.normalized_product_id, p.default_thumbnail_url
      ORDER BY match_score DESC, p.release_date DESC
      LIMIT ${limit - relatedProducts.length}
    `);

    relatedProducts.push(
      ...(sameTagProducts.rows as any[]).map(p => ({
        ...p,
        matchType: 'tag',
        performers: [],
        tags: [],
      }))
    );
  }

  return relatedProducts.slice(0, limit);
}

/**
 * Get related performers based on shared tags/genres
 * Returns performers who share the most common tags with the given performer
 */
export async function getRelatedPerformers(performerId: number, limit: number = 6) {
  try {
    const db = getDb();

    // 同じ作品に出演している共演者を取得
    // ※演者プロフィール画像（minnano-av由来）は使用せず、作品サムネイルを使用
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
      ),
      performer_thumbnails AS (
        SELECT DISTINCT ON (pp.performer_id)
          pp.performer_id,
          prod.default_thumbnail_url as thumbnail_url
        FROM product_performers pp
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE prod.default_thumbnail_url IS NOT NULL
          AND prod.default_thumbnail_url != ''
        ORDER BY pp.performer_id, prod.created_at DESC
      )
      SELECT
        p.id,
        p.name,
        pt.thumbnail_url as "thumbnailUrl",
        pt.thumbnail_url as "heroImageUrl",
        cp.shared_count as "sharedCount",
        (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount"
      FROM performers p
      INNER JOIN co_performers cp ON p.id = cp.performer_id
      LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
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

/**
 * Get recommended actresses based on user's favorite performers
 * B1機能: 「この女優が好きなら」レコメンド
 * お気に入り女優の共演者・ジャンル傾向から類似女優をおすすめ
 */
export async function getRecommendedActressesFromFavorites(
  favoritePerformerIds: number[],
  limit: number = 8
): Promise<Array<{
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  matchScore: number;
  matchReasons: string[];
  genreMatchPercent: number;
  sharedCoStars: number;
}>> {
  if (favoritePerformerIds.length === 0) {
    return [];
  }

  try {
    const db = getDb();

    // お気に入り女優の共演者とジャンル一致率を計算
    const recommendedPerformers = await db.execute(sql`
      WITH favorite_tags AS (
        -- お気に入り女優が出演した作品のタグを収集
        SELECT DISTINCT pt.tag_id, t.name as tag_name
        FROM product_performers pp
        INNER JOIN product_tags pt ON pp.product_id = pt.product_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE pp.performer_id IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
      ),
      favorite_tag_count AS (
        SELECT COUNT(*) as total FROM favorite_tags
      ),
      favorite_products AS (
        -- お気に入り女優の出演作品
        SELECT DISTINCT product_id
        FROM product_performers
        WHERE performer_id IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
      ),
      co_performers AS (
        -- お気に入り女優と共演した女優
        SELECT
          pp.performer_id,
          COUNT(DISTINCT pp.product_id) as shared_product_count
        FROM product_performers pp
        INNER JOIN favorite_products fp ON pp.product_id = fp.product_id
        WHERE pp.performer_id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY pp.performer_id
      ),
      candidate_tags AS (
        -- 候補女優のタグ
        SELECT
          pp.performer_id,
          pt.tag_id
        FROM product_performers pp
        INNER JOIN product_tags pt ON pp.product_id = pt.product_id
        GROUP BY pp.performer_id, pt.tag_id
      ),
      genre_match AS (
        -- ジャンル一致率を計算
        SELECT
          ct.performer_id,
          COUNT(DISTINCT ct.tag_id) FILTER (WHERE ct.tag_id IN (SELECT tag_id FROM favorite_tags)) as matching_tags,
          (SELECT total FROM favorite_tag_count) as total_tags
        FROM candidate_tags ct
        WHERE ct.performer_id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY ct.performer_id
      ),
      performer_thumbnails AS (
        -- 作品サムネイルを取得（演者プロフィール画像は使用しない）
        SELECT DISTINCT ON (pp.performer_id)
          pp.performer_id,
          prod.default_thumbnail_url as thumbnail_url
        FROM product_performers pp
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE prod.default_thumbnail_url IS NOT NULL
          AND prod.default_thumbnail_url != ''
        ORDER BY pp.performer_id, prod.created_at DESC
      )
      SELECT
        p.id,
        p.name,
        pt.thumbnail_url as "thumbnailUrl",
        pt.thumbnail_url as "heroImageUrl",
        (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount",
        COALESCE(cp.shared_product_count, 0) as "sharedCoStars",
        COALESCE(gm.matching_tags, 0) as "matchingTags",
        COALESCE(gm.total_tags, 1) as "totalTags",
        CASE
          WHEN COALESCE(gm.total_tags, 1) > 0
          THEN ROUND((COALESCE(gm.matching_tags, 0)::numeric / GREATEST(gm.total_tags::numeric, 1)) * 100)
          ELSE 0
        END as "genreMatchPercent",
        -- 総合スコア: 共演回数 * 2 + ジャンル一致タグ数
        (COALESCE(cp.shared_product_count, 0) * 2 + COALESCE(gm.matching_tags, 0)) as "matchScore"
      FROM performers p
      LEFT JOIN co_performers cp ON p.id = cp.performer_id
      LEFT JOIN genre_match gm ON p.id = gm.performer_id
      LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
      WHERE p.id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
        AND (cp.shared_product_count > 0 OR gm.matching_tags > 5)
      ORDER BY
        "matchScore" DESC,
        "genreMatchPercent" DESC,
        "productCount" DESC
      LIMIT ${limit}
    `);

    // マッチ理由を生成
    return (recommendedPerformers.rows as any[]).map(p => {
      const matchReasons: string[] = [];
      if (p.sharedCoStars > 0) {
        matchReasons.push(`${p.sharedCoStars}回共演`);
      }
      if (p.genreMatchPercent >= 70) {
        matchReasons.push(`ジャンル${p.genreMatchPercent}%一致`);
      } else if (p.genreMatchPercent >= 50) {
        matchReasons.push(`ジャンル類似`);
      }
      if (matchReasons.length === 0 && p.matchingTags > 0) {
        matchReasons.push(`${p.matchingTags}タグ一致`);
      }

      return {
        id: Number(p.id),
        name: p.name,
        thumbnailUrl: p.thumbnailUrl,
        heroImageUrl: p.heroImageUrl,
        productCount: Number(p.productCount),
        matchScore: Number(p.matchScore),
        matchReasons,
        genreMatchPercent: Number(p.genreMatchPercent),
        sharedCoStars: Number(p.sharedCoStars),
      };
    });
  } catch (error) {
    console.error('Error getting recommended actresses from favorites:', error);
    return [];
  }
}

/**
 * B4機能: 今週の注目（自動キュレーション）
 * 閲覧数増加率、新作、再評価作品を取得
 */
export interface WeeklyHighlights {
  trendingActresses: Array<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
    heroImageUrl: string | null;
    productCount: number;
    viewsThisWeek: number;
    viewsLastWeek: number;
    growthRate: number;
  }>;
  hotNewReleases: Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    releaseDate: string | null;
    rating: number | null;
    viewCount: number;
  }>;
  rediscoveredClassics: Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    releaseDate: string | null;
    recentViews: number;
    daysSinceRelease: number;
  }>;
}

export async function getWeeklyHighlights(): Promise<WeeklyHighlights> {
  const db = getDb();

  // FANZAのみのフィルター条件
  const fanzaFilter = sql`EXISTS (
    SELECT 1 FROM product_sources ps
    WHERE ps.product_id = p.id
    AND LOWER(ps.asp_name) = 'fanza'
  )`;

  // 1. 急上昇女優（今週 vs 先週の閲覧数比較）- FANZAのみ
  // ※演者プロフィール画像（minnano-av由来）は使用せず、作品サムネイルを使用
  const trendingActresses = await db.execute(sql`
    WITH fanza_products AS (
      -- FANZA作品のみを抽出
      SELECT DISTINCT p.id
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE LOWER(ps.asp_name) = 'fanza'
    ),
    this_week_views AS (
      SELECT
        pp.performer_id,
        COUNT(*) as view_count
      FROM product_views pv
      INNER JOIN product_performers pp ON pv.product_id = pp.product_id
      INNER JOIN fanza_products fp ON pv.product_id = fp.id
      WHERE pv.viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY pp.performer_id
    ),
    last_week_views AS (
      SELECT
        pp.performer_id,
        COUNT(*) as view_count
      FROM product_views pv
      INNER JOIN product_performers pp ON pv.product_id = pp.product_id
      INNER JOIN fanza_products fp ON pv.product_id = fp.id
      WHERE pv.viewed_at >= NOW() - INTERVAL '14 days'
        AND pv.viewed_at < NOW() - INTERVAL '7 days'
      GROUP BY pp.performer_id
    ),
    performer_thumbnails AS (
      SELECT DISTINCT ON (pp.performer_id)
        pp.performer_id,
        prod.default_thumbnail_url as thumbnail_url
      FROM product_performers pp
      INNER JOIN products prod ON pp.product_id = prod.id
      INNER JOIN fanza_products fp ON prod.id = fp.id
      WHERE prod.default_thumbnail_url IS NOT NULL
        AND prod.default_thumbnail_url != ''
      ORDER BY pp.performer_id, prod.created_at DESC
    ),
    fanza_product_counts AS (
      -- FANZA作品のみの出演数をカウント
      SELECT pp.performer_id, COUNT(*) as product_count
      FROM product_performers pp
      INNER JOIN fanza_products fp ON pp.product_id = fp.id
      GROUP BY pp.performer_id
    )
    SELECT
      p.id,
      p.name,
      pt.thumbnail_url as "thumbnailUrl",
      pt.thumbnail_url as "heroImageUrl",
      COALESCE(fpc.product_count, 0) as "productCount",
      COALESCE(tw.view_count, 0) as "viewsThisWeek",
      COALESCE(lw.view_count, 0) as "viewsLastWeek",
      CASE
        WHEN COALESCE(lw.view_count, 0) = 0 THEN COALESCE(tw.view_count, 0) * 100
        ELSE ROUND(((COALESCE(tw.view_count, 0) - COALESCE(lw.view_count, 0))::numeric / GREATEST(lw.view_count, 1)) * 100)
      END as "growthRate"
    FROM performers p
    LEFT JOIN this_week_views tw ON p.id = tw.performer_id
    LEFT JOIN last_week_views lw ON p.id = lw.performer_id
    LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
    LEFT JOIN fanza_product_counts fpc ON p.id = fpc.performer_id
    WHERE COALESCE(tw.view_count, 0) >= 3
      AND fpc.product_count > 0
    ORDER BY "growthRate" DESC, "viewsThisWeek" DESC
    LIMIT 6
  `);

  // 2. 話題の新作（今週リリース + 高評価/高閲覧）- FANZAのみ
  const hotNewReleases = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.release_date as "releaseDate",
      COALESCE(prs.average_rating, 0) as "rating",
      (
        SELECT COUNT(*)
        FROM product_views pv
        WHERE pv.product_id = p.id
          AND pv.viewed_at >= NOW() - INTERVAL '7 days'
      ) as "viewCount"
    FROM products p
    LEFT JOIN product_rating_summary prs ON p.id = prs.product_id
    WHERE p.release_date >= NOW() - INTERVAL '14 days'
      AND ${fanzaFilter}
    ORDER BY "viewCount" DESC, prs.average_rating DESC NULLS LAST
    LIMIT 6
  `);

  // 3. 再評価作品（1年以上前の作品で最近閲覧が増えているもの）- FANZAのみ
  const rediscoveredClassics = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.release_date as "releaseDate",
      COUNT(pv.id) as "recentViews",
      EXTRACT(DAY FROM NOW() - p.release_date::timestamp) as "daysSinceRelease"
    FROM products p
    INNER JOIN product_views pv ON p.id = pv.product_id
    WHERE p.release_date < NOW() - INTERVAL '365 days'
      AND pv.viewed_at >= NOW() - INTERVAL '7 days'
      AND ${fanzaFilter}
    GROUP BY p.id, p.title, p.default_thumbnail_url, p.release_date
    HAVING COUNT(pv.id) >= 2
    ORDER BY "recentViews" DESC
    LIMIT 6
  `);

  return {
    trendingActresses: (trendingActresses.rows as any[]).map(r => ({
      id: Number(r.id),
      name: r.name,
      thumbnailUrl: r.thumbnailUrl,
      heroImageUrl: r.heroImageUrl,
      productCount: Number(r.productCount),
      viewsThisWeek: Number(r.viewsThisWeek),
      viewsLastWeek: Number(r.viewsLastWeek),
      growthRate: Number(r.growthRate),
    })),
    hotNewReleases: (hotNewReleases.rows as any[]).map(r => ({
      id: Number(r.id),
      title: r.title,
      imageUrl: r.imageUrl,
      releaseDate: r.releaseDate,
      rating: r.rating ? Number(r.rating) : null,
      viewCount: Number(r.viewCount),
    })),
    rediscoveredClassics: (rediscoveredClassics.rows as any[]).map(r => ({
      id: Number(r.id),
      title: r.title,
      imageUrl: r.imageUrl,
      releaseDate: r.releaseDate,
      recentViews: Number(r.recentViews),
      daysSinceRelease: Number(r.daysSinceRelease),
    })),
  };
}

/**
 * Get related performers with genre match percentage
 * Returns performers who share tags and calculates match percentage
 */
export async function getRelatedPerformersWithGenreMatch(performerId: number, limit: number = 6) {
  try {
    const db = getDb();

    // 共演者 + ジャンル一致率を計算
    const relatedPerformers = await db.execute(sql`
      WITH performer_tags AS (
        -- 対象女優のタグを取得
        SELECT DISTINCT pt.tag_id
        FROM product_performers pp
        INNER JOIN product_tags pt ON pp.product_id = pt.product_id
        WHERE pp.performer_id = ${performerId}
      ),
      performer_tag_count AS (
        SELECT COUNT(*) as total FROM performer_tags
      ),
      performer_products AS (
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
      ),
      co_performer_tags AS (
        -- 共演者のタグを取得
        SELECT
          pp.performer_id,
          pt.tag_id
        FROM product_performers pp
        INNER JOIN product_tags pt ON pp.product_id = pt.product_id
        WHERE pp.performer_id IN (SELECT performer_id FROM co_performers)
        GROUP BY pp.performer_id, pt.tag_id
      ),
      genre_match AS (
        SELECT
          cpt.performer_id,
          COUNT(DISTINCT cpt.tag_id) FILTER (WHERE cpt.tag_id IN (SELECT tag_id FROM performer_tags)) as matching_tags,
          (SELECT total FROM performer_tag_count) as total_tags
        FROM co_performer_tags cpt
        GROUP BY cpt.performer_id
      ),
      performer_thumbnails AS (
        -- 作品サムネイルを取得（演者プロフィール画像は使用しない）
        SELECT DISTINCT ON (pp.performer_id)
          pp.performer_id,
          prod.default_thumbnail_url as thumbnail_url
        FROM product_performers pp
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE prod.default_thumbnail_url IS NOT NULL
          AND prod.default_thumbnail_url != ''
        ORDER BY pp.performer_id, prod.created_at DESC
      )
      SELECT
        p.id,
        p.name,
        pth.thumbnail_url as "thumbnailUrl",
        pth.thumbnail_url as "heroImageUrl",
        cp.shared_count as "sharedCount",
        (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount",
        COALESCE(gm.matching_tags, 0) as "matchingTags",
        COALESCE(gm.total_tags, 0) as "totalTags",
        CASE
          WHEN COALESCE(gm.total_tags, 0) > 0
          THEN ROUND((COALESCE(gm.matching_tags, 0)::numeric / gm.total_tags::numeric) * 100)
          ELSE 0
        END as "genreMatchPercent"
      FROM performers p
      INNER JOIN co_performers cp ON p.id = cp.performer_id
      LEFT JOIN genre_match gm ON p.id = gm.performer_id
      LEFT JOIN performer_thumbnails pth ON p.id = pth.performer_id
      ORDER BY
        -- 共演回数 * ジャンル一致率でスコアリング
        (cp.shared_count * COALESCE(gm.matching_tags, 0)) DESC,
        cp.shared_count DESC,
        p.name ASC
      LIMIT ${limit}
    `);

    return relatedPerformers.rows as Array<{
      id: number;
      name: string;
      thumbnailUrl: string | null;
      heroImageUrl: string | null;
      sharedCount: number;
      productCount: number;
      matchingTags: number;
      totalTags: number;
      genreMatchPercent: number;
    }>;
  } catch (error) {
    console.error('Error getting related performers with genre match:', error);
    return [];
  }
}

/**
 * E2機能: みんなの視聴パターン統計
 * 匿名の閲覧データに基づくレコメンド
 */
export interface ViewingPatternStats {
  alsoViewed: Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    coViewRate: number; // この作品を見た人が他の作品も見た割合(%)
    viewCount: number;
  }>;
  popularTimes: Array<{
    hour: number;
    viewCount: number;
  }>;
  viewerProfile: {
    avgProductsViewed: number;
    topGenres: Array<{ tagName: string; count: number }>;
    repeatViewRate: number; // 再視聴率(%)
  };
}

export async function getViewingPatternStats(productId: number): Promise<ViewingPatternStats> {
  const db = getDb();

  // 1. この作品を見た人が他に見た作品 (上位6件)
  const alsoViewedResult = await db.execute(sql`
    WITH product_viewers AS (
      -- この作品を見たセッション(IP)を取得
      SELECT DISTINCT session_id
      FROM product_views
      WHERE product_id = ${productId}
        AND session_id IS NOT NULL
    ),
    viewer_count AS (
      SELECT COUNT(DISTINCT session_id) as total FROM product_viewers
    ),
    co_viewed AS (
      -- 同じセッションが見た他の作品
      SELECT
        pv.product_id,
        COUNT(DISTINCT pv.session_id) as co_view_count
      FROM product_views pv
      INNER JOIN product_viewers pv_ref ON pv.session_id = pv_ref.session_id
      WHERE pv.product_id != ${productId}
      GROUP BY pv.product_id
      HAVING COUNT(DISTINCT pv.session_id) >= 2
    )
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      cv.co_view_count as "coViewCount",
      ROUND((cv.co_view_count::numeric / GREATEST(vc.total, 1)) * 100) as "coViewRate",
      (SELECT COUNT(*) FROM product_views WHERE product_id = p.id) as "viewCount"
    FROM products p
    INNER JOIN co_viewed cv ON p.id = cv.product_id
    CROSS JOIN viewer_count vc
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
    )
    ORDER BY cv.co_view_count DESC, "viewCount" DESC
    LIMIT 6
  `);

  // 2. 人気の時間帯 (この作品が視聴された時間帯)
  const popularTimesResult = await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM viewed_at) as hour,
      COUNT(*) as view_count
    FROM product_views
    WHERE product_id = ${productId}
    GROUP BY EXTRACT(HOUR FROM viewed_at)
    ORDER BY hour
  `);

  // 3. 視聴者プロファイル (この作品を見た人の傾向)
  const viewerProfileResult = await db.execute(sql`
    WITH product_viewers AS (
      SELECT DISTINCT session_id
      FROM product_views
      WHERE product_id = ${productId}
        AND session_id IS NOT NULL
    ),
    viewer_products AS (
      SELECT
        pv.session_id,
        pv.product_id,
        COUNT(*) OVER (PARTITION BY pv.session_id) as products_per_viewer
      FROM product_views pv
      INNER JOIN product_viewers pvr ON pv.session_id = pvr.session_id
    ),
    viewer_stats AS (
      SELECT
        AVG(products_per_viewer) as avg_products,
        (
          SELECT COUNT(*) FROM product_views pv
          WHERE pv.product_id = ${productId}
            AND EXISTS (
              SELECT 1 FROM product_views pv2
              WHERE pv2.session_id = pv.session_id
                AND pv2.product_id = pv.product_id
                AND pv2.id < pv.id
            )
        )::numeric / GREATEST(
          (SELECT COUNT(*) FROM product_views WHERE product_id = ${productId}),
          1
        ) * 100 as repeat_rate
      FROM viewer_products
    )
    SELECT
      COALESCE(avg_products, 0) as "avgProductsViewed",
      COALESCE(repeat_rate, 0) as "repeatViewRate"
    FROM viewer_stats
  `);

  // 4. この作品を見た人が好むジャンル
  const topGenresResult = await db.execute(sql`
    WITH product_viewers AS (
      SELECT DISTINCT session_id
      FROM product_views
      WHERE product_id = ${productId}
        AND session_id IS NOT NULL
    ),
    viewer_product_tags AS (
      SELECT DISTINCT
        pt.tag_id
      FROM product_views pv
      INNER JOIN product_viewers pvr ON pv.session_id = pvr.session_id
      INNER JOIN product_tags pt ON pv.product_id = pt.product_id
    )
    SELECT
      t.name as "tagName",
      COUNT(*) as count
    FROM viewer_product_tags vpt
    INNER JOIN tags t ON vpt.tag_id = t.id
    WHERE t.category = 'genre' OR t.category IS NULL
    GROUP BY t.name
    ORDER BY count DESC
    LIMIT 5
  `);

  const alsoViewed = (alsoViewedResult.rows as any[]).map(r => ({
    id: Number(r.id),
    title: r.title,
    imageUrl: r.imageUrl,
    coViewRate: Number(r.coViewRate),
    viewCount: Number(r.viewCount),
  }));

  const popularTimes = (popularTimesResult.rows as any[]).map(r => ({
    hour: Number(r.hour),
    viewCount: Number(r.view_count),
  }));

  const viewerStats = viewerProfileResult.rows[0] as any || { avgProductsViewed: 0, repeatViewRate: 0 };
  const topGenres = (topGenresResult.rows as any[]).map(r => ({
    tagName: r.tagName,
    count: Number(r.count),
  }));

  return {
    alsoViewed,
    popularTimes,
    viewerProfile: {
      avgProductsViewed: Number(viewerStats.avgProductsViewed) || 0,
      topGenres,
      repeatViewRate: Number(viewerStats.repeatViewRate) || 0,
    },
  };
}
