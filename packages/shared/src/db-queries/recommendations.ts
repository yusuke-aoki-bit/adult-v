/**
 * 共有レコメンデーションDBクエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, inArray, ne, sql, desc, SQL } from 'drizzle-orm';

// DB行結果の型定義
interface PerformerRow {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number | string;
  viewsThisWeek?: number | string;
  viewsLastWeek?: number | string;
  growthRate?: number | string;
  sharedCoStars?: number | string;
  matchingTags?: number | string;
  totalTags?: number | string;
  genreMatchPercent?: number | string;
  matchScore?: number | string;
  sharedCount?: number | string;
}

interface HotReleaseRow {
  id: number;
  title: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  rating: number | string | null;
  viewCount: number | string;
}

interface ClassicRow {
  id: number;
  title: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  recentViews: number | string;
  daysSinceRelease: number | string;
}

interface IdRow {
  id: number;
}

interface ProductRow {
  id: number;
  title: string | null;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate?: string | null;
  match_score?: number;
}

interface ViewPatternRow {
  id: number;
  title: string | null;
  imageUrl: string | null;
  coViewCount: number | string;
  coViewRate: number | string;
  viewCount: number | string;
}

interface HourRow {
  hour: number | string;
  view_count: number | string;
}

interface GenreRow {
  tagName: string;
  count: number | string;
}

interface ViewerStatsRow {
  avgProductsViewed: number | string;
  repeatViewRate: number | string;
}

// 外部APIとして使う戻り値型
export interface RelatedProductResult {
  id: string;
  title: string;
  normalizedProductId: string | null;
  releaseDate: string | null;
  imageUrl: string | null;
  matchType: 'performer' | 'tag' | 'recent';
}

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

export interface ViewingPatternStats {
  alsoViewed: Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    coViewRate: number;
    viewCount: number;
  }>;
  popularTimes: Array<{
    hour: number;
    viewCount: number;
  }>;
  viewerProfile: {
    avgProductsViewed: number;
    topGenres: Array<{ tagName: string; count: number }>;
    repeatViewRate: number;
  };
}

export interface RecommendedActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  matchScore: number;
  matchReasons: string[];
  genreMatchPercent: number;
  sharedCoStars: number;
}

export interface RelatedPerformer {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  sharedCount: number;
  productCount: number;
}

export interface RelatedPerformerWithGenre extends RelatedPerformer {
  matchingTags: number;
  totalTags: number;
  genreMatchPercent: number;
}

export interface SimilarActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  matchingTags: number;
  totalTags: number;
  genreMatchPercent: number;
  topMatchingGenres: string[];
}

export interface TopRatedProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  reviewCount: number;
  viewCount: number;
  rank: number;
  salePrice: number | null;
  saleEndAt: string | null;
}

export interface PerformerOnSaleProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  originalPrice: number | null;
  salePrice: number;
  saleEndAt: string;
  discountPercent: number;
}

// 依存性の型定義
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RecommendationsDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productTags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources?: any;
}


/**
 * レコメンデーションクエリファクトリー
 */
export function createRecommendationsQueries(deps: RecommendationsDeps) {
  const { getDb, products, productPerformers, productTags, productSources } = deps;

  /**
   * 関連作品を取得
   */
  async function getRelatedProducts(
    productId: string,
    limit: number = 6,
    aspName?: string
  ): Promise<RelatedProductResult[]> {
    const db = getDb();
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

    const performerIds = (performerData as { performerId: number }[]).map((pp) => pp.performerId);
    const tagIds = (tagData as { tagId: number }[]).map((pt) => pt.tagId);

    // ASPフィルター条件
    const aspFilterCondition = aspName && productSources
      ? sql`EXISTS (SELECT 1 FROM ${productSources} ps WHERE ps.product_id = ${products.id} AND LOWER(ps.asp_name) = ${aspName.toLowerCase()})`
      : sql`1=1`;

    // Strategy 1: Same performers (highest priority)
    type RelatedProduct = {
      id: number;
      title: string | null;
      normalizedProductId: string | null;
      releaseDate: Date | null;
      imageUrl: string | null;
      matchScore: number;
      matchType: 'performer' | 'tag' | 'recent';
    };
    let relatedProducts: RelatedProduct[] = [];

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

      relatedProducts = samePerformerProducts.map((p: RelatedProduct) => ({
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
        ...sameTagProducts.map((p: RelatedProduct) => ({
          ...p,
          matchType: 'tag' as const,
        }))
      );
    }

    // Strategy 3: Recent products (if still need more)
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
        ...recentProducts.map((p: Omit<RelatedProduct, 'matchScore' | 'matchType'>) => ({
          ...p,
          matchScore: 0,
          matchType: 'recent' as const,
        }))
      );
    }

    // 外部APIに適した型に変換して返す
    return relatedProducts.slice(0, limit).map((p) => {
      // releaseDateはDate型または文字列の場合がある
      let releaseDateStr: string | null = null;
      const releaseDate = p.releaseDate as Date | string | null;
      if (releaseDate) {
        if (releaseDate instanceof Date) {
          releaseDateStr = releaseDate.toISOString().split('T')[0];
        } else if (typeof releaseDate === 'string') {
          releaseDateStr = releaseDate.split('T')[0];
        }
      }
      return {
        id: String(p.id),
        title: p.title || '',
        normalizedProductId: p.normalizedProductId,
        releaseDate: releaseDateStr,
        imageUrl: p.imageUrl,
        matchType: p.matchType,
      };
    });
  }

  /**
   * 今週の注目を取得
   */
  async function getWeeklyHighlights(aspFilter?: SQL): Promise<WeeklyHighlights> {
    const db = getDb();

    const defaultFilter = sql`NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
    )`;

    const filter = aspFilter || defaultFilter;

    // 1. 急上昇女優
    const trendingActresses = await db.execute(sql`
      WITH performer_thumbnails AS (
        SELECT DISTINCT ON (pp.performer_id)
          pp.performer_id,
          prod.default_thumbnail_url as thumbnail_url
        FROM product_performers pp
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE prod.default_thumbnail_url IS NOT NULL
          AND prod.default_thumbnail_url != ''
        ORDER BY pp.performer_id, prod.created_at DESC
      ),
      this_week_views AS (
        SELECT
          pp.performer_id,
          COUNT(*) as view_count
        FROM product_views pv
        INNER JOIN product_performers pp ON pv.product_id = pp.product_id
        WHERE pv.viewed_at >= NOW() - INTERVAL '7 days'
        GROUP BY pp.performer_id
      ),
      last_week_views AS (
        SELECT
          pp.performer_id,
          COUNT(*) as view_count
        FROM product_views pv
        INNER JOIN product_performers pp ON pv.product_id = pp.product_id
        WHERE pv.viewed_at >= NOW() - INTERVAL '14 days'
          AND pv.viewed_at < NOW() - INTERVAL '7 days'
        GROUP BY pp.performer_id
      )
      SELECT
        p.id,
        p.name,
        pt.thumbnail_url as "thumbnailUrl",
        pt.thumbnail_url as "heroImageUrl",
        (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount",
        COALESCE(tw.view_count, 0) as "viewsThisWeek",
        COALESCE(lw.view_count, 0) as "viewsLastWeek",
        CASE
          WHEN COALESCE(lw.view_count, 0) = 0 THEN COALESCE(tw.view_count, 0) * 100
          ELSE ROUND(((COALESCE(tw.view_count, 0) - COALESCE(lw.view_count, 0))::numeric / GREATEST(lw.view_count, 1)) * 100)
        END as "growthRate"
      FROM performers p
      LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
      LEFT JOIN this_week_views tw ON p.id = tw.performer_id
      LEFT JOIN last_week_views lw ON p.id = lw.performer_id
      WHERE COALESCE(tw.view_count, 0) >= 3
      ORDER BY "growthRate" DESC, "viewsThisWeek" DESC
      LIMIT 6
    `);

    // 2. 話題の新作
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
        AND ${filter}
      ORDER BY "viewCount" DESC, prs.average_rating DESC NULLS LAST
      LIMIT 6
    `);

    // 3. 再評価作品
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
        AND ${filter}
      GROUP BY p.id, p.title, p.default_thumbnail_url, p.release_date
      HAVING COUNT(pv.id) >= 2
      ORDER BY "recentViews" DESC
      LIMIT 6
    `);

    return {
      trendingActresses: (trendingActresses.rows as PerformerRow[]).map(r => ({
        id: Number(r.id),
        name: r.name,
        thumbnailUrl: r.thumbnailUrl,
        heroImageUrl: r.heroImageUrl,
        productCount: Number(r.productCount),
        viewsThisWeek: Number(r.viewsThisWeek),
        viewsLastWeek: Number(r.viewsLastWeek),
        growthRate: Number(r.growthRate),
      })),
      hotNewReleases: (hotNewReleases.rows as HotReleaseRow[]).map(r => ({
        id: Number(r.id),
        title: r.title || '',
        imageUrl: r.imageUrl,
        releaseDate: r.releaseDate,
        rating: r.rating ? Number(r.rating) : null,
        viewCount: Number(r.viewCount),
      })),
      rediscoveredClassics: (rediscoveredClassics.rows as ClassicRow[]).map(r => ({
        id: Number(r.id),
        title: r.title || '',
        imageUrl: r.imageUrl,
        releaseDate: r.releaseDate,
        recentViews: Number(r.recentViews),
        daysSinceRelease: Number(r.daysSinceRelease),
      })),
    };
  }

  /**
   * 視聴パターン統計を取得
   */
  async function getViewingPatternStats(productId: number): Promise<ViewingPatternStats> {
    const db = getDb();

    // 1. この作品を見た人が他に見た作品
    const alsoViewedResult = await db.execute(sql`
      WITH product_viewers AS (
        SELECT DISTINCT session_id
        FROM product_views
        WHERE product_id = ${productId}
          AND session_id IS NOT NULL
      ),
      viewer_count AS (
        SELECT COUNT(DISTINCT session_id) as total FROM product_viewers
      ),
      co_viewed AS (
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

    // 2. 人気の時間帯
    const popularTimesResult = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM viewed_at) as hour,
        COUNT(*) as view_count
      FROM product_views
      WHERE product_id = ${productId}
      GROUP BY EXTRACT(HOUR FROM viewed_at)
      ORDER BY hour
    `);

    // 3. 視聴者プロファイル
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

    // 4. トップジャンル
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

    const alsoViewed = (alsoViewedResult.rows as ViewPatternRow[]).map(r => ({
      id: Number(r.id),
      title: r.title || '',
      imageUrl: r.imageUrl,
      coViewRate: Number(r.coViewRate),
      viewCount: Number(r.viewCount),
    }));

    const popularTimes = (popularTimesResult.rows as HourRow[]).map(r => ({
      hour: Number(r.hour),
      viewCount: Number(r.view_count),
    }));

    const viewerStats = (viewerProfileResult.rows[0] as ViewerStatsRow | undefined) || { avgProductsViewed: 0, repeatViewRate: 0 };
    const topGenres = (topGenresResult.rows as GenreRow[]).map(r => ({
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

  /**
   * お気に入りから女優をレコメンド
   */
  async function getRecommendedActressesFromFavorites(
    favoritePerformerIds: number[],
    limit: number = 8
  ): Promise<RecommendedActress[]> {
    if (favoritePerformerIds.length === 0) {
      return [];
    }

    try {
      const db = getDb();

      const recommendedPerformers = await db.execute(sql`
        WITH performer_thumbnails AS (
          SELECT DISTINCT ON (pp.performer_id)
            pp.performer_id,
            prod.default_thumbnail_url as thumbnail_url
          FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
          ORDER BY pp.performer_id, prod.created_at DESC
        ),
        favorite_tags AS (
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
          SELECT DISTINCT product_id
          FROM product_performers
          WHERE performer_id IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
        ),
        co_performers AS (
          SELECT
            pp.performer_id,
            COUNT(DISTINCT pp.product_id) as shared_product_count
          FROM product_performers pp
          INNER JOIN favorite_products fp ON pp.product_id = fp.product_id
          WHERE pp.performer_id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
          GROUP BY pp.performer_id
        ),
        candidate_tags AS (
          SELECT
            pp.performer_id,
            pt.tag_id
          FROM product_performers pp
          INNER JOIN product_tags pt ON pp.product_id = pt.product_id
          GROUP BY pp.performer_id, pt.tag_id
        ),
        genre_match AS (
          SELECT
            ct.performer_id,
            COUNT(DISTINCT ct.tag_id) FILTER (WHERE ct.tag_id IN (SELECT tag_id FROM favorite_tags)) as matching_tags,
            (SELECT total FROM favorite_tag_count) as total_tags
          FROM candidate_tags ct
          WHERE ct.performer_id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
          GROUP BY ct.performer_id
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
          (COALESCE(cp.shared_product_count, 0) * 2 + COALESCE(gm.matching_tags, 0)) as "matchScore"
        FROM performers p
        LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
        LEFT JOIN co_performers cp ON p.id = cp.performer_id
        LEFT JOIN genre_match gm ON p.id = gm.performer_id
        WHERE p.id NOT IN (${sql.join(favoritePerformerIds.map(id => sql`${id}`), sql`, `)})
          AND (cp.shared_product_count > 0 OR gm.matching_tags > 5)
        ORDER BY
          "matchScore" DESC,
          "genreMatchPercent" DESC,
          "productCount" DESC
        LIMIT ${limit}
      `);

      return (recommendedPerformers.rows as PerformerRow[]).map(p => {
        const matchReasons: string[] = [];
        const sharedCoStars = Number(p.sharedCoStars);
        const genreMatchPercent = Number(p.genreMatchPercent);
        const matchingTags = Number(p.matchingTags);

        if (sharedCoStars > 0) {
          matchReasons.push(`${sharedCoStars}回共演`);
        }
        if (genreMatchPercent >= 70) {
          matchReasons.push(`ジャンル${genreMatchPercent}%一致`);
        } else if (genreMatchPercent >= 50) {
          matchReasons.push(`ジャンル類似`);
        }
        if (matchReasons.length === 0 && matchingTags > 0) {
          matchReasons.push(`${matchingTags}タグ一致`);
        }

        return {
          id: Number(p.id),
          name: p.name,
          thumbnailUrl: p.thumbnailUrl,
          heroImageUrl: p.heroImageUrl,
          productCount: Number(p.productCount),
          matchScore: Number(p.matchScore),
          matchReasons,
          genreMatchPercent,
          sharedCoStars,
        };
      });
    } catch (error) {
      console.error('Error getting recommended actresses from favorites:', error);
      return [];
    }
  }

  /**
   * 関連演者を取得
   */
  async function getRelatedPerformers(
    performerId: number,
    limit: number = 6
  ): Promise<RelatedPerformer[]> {
    try {
      const db = getDb();

      const coPerformers = await db.execute(sql`
        WITH performer_thumbnails AS (
          SELECT DISTINCT ON (pp.performer_id)
            pp.performer_id,
            prod.default_thumbnail_url as thumbnail_url
          FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
          ORDER BY pp.performer_id, prod.created_at DESC
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

      return coPerformers.rows as RelatedPerformer[];
    } catch {
      return [];
    }
  }

  /**
   * 関連演者をジャンル一致率付きで取得
   */
  async function getRelatedPerformersWithGenreMatch(
    performerId: number,
    limit: number = 6
  ): Promise<RelatedPerformerWithGenre[]> {
    try {
      const db = getDb();

      const relatedPerformers = await db.execute(sql`
        WITH performer_thumbnails AS (
          SELECT DISTINCT ON (pp.performer_id)
            pp.performer_id,
            prod.default_thumbnail_url as thumbnail_url
          FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
          ORDER BY pp.performer_id, prod.created_at DESC
        ),
        performer_tags AS (
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
        )
        SELECT
          p.id,
          p.name,
          pt.thumbnail_url as "thumbnailUrl",
          pt.thumbnail_url as "heroImageUrl",
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
        LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
        LEFT JOIN genre_match gm ON p.id = gm.performer_id
        ORDER BY
          (cp.shared_count * COALESCE(gm.matching_tags, 0)) DESC,
          cp.shared_count DESC,
          p.name ASC
        LIMIT ${limit}
      `);

      return relatedPerformers.rows as RelatedPerformerWithGenre[];
    } catch (error) {
      console.error('Error getting related performers with genre match:', error);
      return [];
    }
  }

  /**
   * 名前からIDを取得してから関連作品を取得
   */
  async function getRelatedProductsByNames(options: {
    performers: string[];
    tags: string[];
    excludeProductId?: string;
    limit?: number;
  }): Promise<Array<ProductRow & { matchType: string; performers: string[]; tags: string[] }>> {
    const { performers = [], tags = [], excludeProductId, limit = 6 } = options;
    const db = getDb();
    const excludeId = excludeProductId ? parseInt(excludeProductId, 10) : null;

    // Build performer IDs from names
    let performerIds: number[] = [];
    if (performers.length > 0) {
      const performerResults = await db.execute(sql`
        SELECT id FROM performers WHERE name IN (${sql.join(performers.map(p => sql`${p}`), sql`, `)})
      `);
      performerIds = (performerResults.rows as IdRow[]).map(r => r.id);
    }

    // Build tag IDs from names
    let tagIds: number[] = [];
    if (tags.length > 0) {
      const tagResults = await db.execute(sql`
        SELECT id FROM tags WHERE name IN (${sql.join(tags.map(t => sql`${t}`), sql`, `)})
      `);
      tagIds = (tagResults.rows as IdRow[]).map(r => r.id);
    }

    let relatedProducts: Array<ProductRow & { matchType: string; performers: string[]; tags: string[] }> = [];

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

      relatedProducts = (samePerformerProducts.rows as ProductRow[]).map(p => ({
        ...p,
        matchType: 'performer',
        performers: [] as string[],
        tags: [] as string[],
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
        ...(sameTagProducts.rows as ProductRow[]).map(p => ({
          ...p,
          matchType: 'tag',
          performers: [] as string[],
          tags: [] as string[],
        }))
      );
    }

    return relatedProducts.slice(0, limit);
  }

  /**
   * 類似女優を取得（共演なしでもジャンルが似ている女優を推奨）
   * 共演者とは異なり、直接の共演はないが同じジャンルの作品に多く出演している女優を提案
   */
  async function getSimilarActresses(
    performerId: number,
    limit: number = 6
  ): Promise<SimilarActress[]> {
    try {
      const db = getDb();

      const similarActresses = await db.execute(sql`
        WITH performer_thumbnails AS (
          SELECT DISTINCT ON (pp.performer_id)
            pp.performer_id,
            prod.default_thumbnail_url as thumbnail_url
          FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
          ORDER BY pp.performer_id, prod.created_at DESC
        ),
        -- 対象女優のジャンルタグを取得
        performer_genre_tags AS (
          SELECT DISTINCT t.id, t.name
          FROM product_performers pp
          INNER JOIN product_tags pt ON pp.product_id = pt.product_id
          INNER JOIN tags t ON pt.tag_id = t.id
          WHERE pp.performer_id = ${performerId}
            AND (t.category = 'genre' OR t.category IS NULL)
        ),
        performer_tag_count AS (
          SELECT COUNT(*) as total FROM performer_genre_tags
        ),
        -- 共演者のIDを取得（除外用）
        co_performer_ids AS (
          SELECT DISTINCT pp2.performer_id
          FROM product_performers pp1
          INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
          WHERE pp1.performer_id = ${performerId}
            AND pp2.performer_id != ${performerId}
        ),
        -- 他の女優のジャンルタグとの一致を計算
        other_performer_genre_match AS (
          SELECT
            pp.performer_id,
            t.id as tag_id,
            t.name as tag_name,
            CASE WHEN pgt.id IS NOT NULL THEN 1 ELSE 0 END as is_matching
          FROM product_performers pp
          INNER JOIN product_tags pt ON pp.product_id = pt.product_id
          INNER JOIN tags t ON pt.tag_id = t.id
          LEFT JOIN performer_genre_tags pgt ON t.id = pgt.id
          WHERE pp.performer_id != ${performerId}
            AND pp.performer_id NOT IN (SELECT performer_id FROM co_performer_ids)
            AND (t.category = 'genre' OR t.category IS NULL)
          GROUP BY pp.performer_id, t.id, t.name, pgt.id
        ),
        -- 女優ごとのマッチング集計
        performer_match_summary AS (
          SELECT
            performer_id,
            COUNT(DISTINCT tag_id) FILTER (WHERE is_matching = 1) as matching_tags,
            ARRAY_AGG(DISTINCT tag_name) FILTER (WHERE is_matching = 1) as matching_genre_names
          FROM other_performer_genre_match
          GROUP BY performer_id
          HAVING COUNT(DISTINCT tag_id) FILTER (WHERE is_matching = 1) >= 3
        )
        SELECT
          p.id,
          p.name,
          pt.thumbnail_url as "thumbnailUrl",
          pt.thumbnail_url as "heroImageUrl",
          (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) as "productCount",
          pms.matching_tags as "matchingTags",
          (SELECT total FROM performer_tag_count) as "totalTags",
          CASE
            WHEN (SELECT total FROM performer_tag_count) > 0
            THEN ROUND((pms.matching_tags::numeric / (SELECT total FROM performer_tag_count)::numeric) * 100)
            ELSE 0
          END as "genreMatchPercent",
          pms.matching_genre_names as "topMatchingGenres"
        FROM performers p
        INNER JOIN performer_match_summary pms ON p.id = pms.performer_id
        LEFT JOIN performer_thumbnails pt ON p.id = pt.performer_id
        WHERE (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) >= 5
        ORDER BY
          pms.matching_tags DESC,
          (SELECT COUNT(*) FROM product_performers WHERE performer_id = p.id) DESC,
          p.name ASC
        LIMIT ${limit}
      `);

      interface SimilarActressRow {
        id: number;
        name: string;
        thumbnailUrl: string | null;
        heroImageUrl: string | null;
        productCount: number | string;
        matchingTags: number | string;
        totalTags: number | string;
        genreMatchPercent: number | string;
        topMatchingGenres: string[] | null;
      }

      return (similarActresses.rows as SimilarActressRow[]).map(row => ({
        id: row.id,
        name: row.name,
        thumbnailUrl: row.thumbnailUrl,
        heroImageUrl: row.heroImageUrl,
        productCount: typeof row.productCount === 'string' ? parseInt(row.productCount) : row.productCount,
        matchingTags: typeof row.matchingTags === 'string' ? parseInt(row.matchingTags) : row.matchingTags,
        totalTags: typeof row.totalTags === 'string' ? parseInt(row.totalTags) : row.totalTags,
        genreMatchPercent: typeof row.genreMatchPercent === 'string' ? parseFloat(row.genreMatchPercent) : row.genreMatchPercent,
        topMatchingGenres: row.topMatchingGenres ? row.topMatchingGenres.slice(0, 5) : [],
      }));
    } catch (error) {
      console.error('Error fetching similar actresses:', error);
      return [];
    }
  }

  /**
   * 女優の人気作品TOP5を取得
   * 評価とレビュー数でランキング（軽量版）
   * @param aspName - ASPフィルター（例: 'fanza'）。指定時は該当ASPの商品のみ返す
   */
  async function getPerformerTopProducts(
    performerId: number,
    limit: number = 5,
    aspName?: string
  ): Promise<TopRatedProduct[]> {
    try {
      const db = getDb();

      // ASPフィルター条件
      const aspFilter = aspName
        ? sql`AND EXISTS (SELECT 1 FROM product_sources ps_asp WHERE ps_asp.product_id = p.id AND LOWER(ps_asp.asp_name) = ${aspName.toLowerCase()})`
        : sql``;

      // 軽量化: product_viewsのサブクエリを削除、LATERAL JOINを削除
      const topProducts = await db.execute(sql`
        SELECT
          p.id,
          p.title,
          p.normalized_product_id as "normalizedProductId",
          p.default_thumbnail_url as "imageUrl",
          p.release_date as "releaseDate",
          COALESCE(prs.average_rating, 0) as rating,
          COALESCE(prs.total_reviews, 0) as "reviewCount",
          0 as "viewCount",
          ROW_NUMBER() OVER (
            ORDER BY
              COALESCE(prs.average_rating, 0) DESC,
              COALESCE(prs.total_reviews, 0) DESC,
              p.release_date DESC NULLS LAST
          ) as rank,
          NULL::integer as "salePrice",
          NULL::timestamptz as "saleEndAt"
        FROM products p
        INNER JOIN product_performers pp ON p.id = pp.product_id
        LEFT JOIN product_rating_summary prs ON p.id = prs.product_id
        WHERE pp.performer_id = ${performerId}
          AND (COALESCE(prs.average_rating, 0) > 0 OR COALESCE(prs.total_reviews, 0) > 0)
          ${aspFilter}
        ORDER BY
          COALESCE(prs.average_rating, 0) DESC,
          COALESCE(prs.total_reviews, 0) DESC,
          p.release_date DESC NULLS LAST
        LIMIT ${limit}
      `);

      interface TopProductRow {
        id: number;
        title: string | null;
        normalizedProductId: string | null;
        imageUrl: string | null;
        releaseDate: string | null;
        rating: number | string | null;
        reviewCount: number | string;
        viewCount: number | string;
        rank: number | string;
        salePrice: number | string | null;
        saleEndAt: string | null;
      }

      return (topProducts.rows as TopProductRow[]).map(row => ({
        id: row.id,
        title: row.title || '',
        normalizedProductId: row.normalizedProductId,
        imageUrl: row.imageUrl,
        releaseDate: row.releaseDate,
        rating: row.rating ? Number(row.rating) : null,
        reviewCount: Number(row.reviewCount),
        viewCount: Number(row.viewCount),
        rank: Number(row.rank),
        salePrice: row.salePrice ? Number(row.salePrice) : null,
        saleEndAt: row.saleEndAt,
      }));
    } catch (error) {
      console.error('Error fetching performer top products:', error);
      return [];
    }
  }

  /**
   * 女優のセール中作品を取得（軽量版）
   * @param aspName - ASPフィルター（例: 'fanza'）。指定時は該当ASPの商品のみ返す
   */
  async function getPerformerOnSaleProducts(
    performerId: number,
    limit: number = 6,
    aspName?: string
  ): Promise<PerformerOnSaleProduct[]> {
    try {
      const db = getDb();

      // ASPフィルター条件
      const aspFilter = aspName
        ? sql`AND LOWER(ps.asp_name) = ${aspName.toLowerCase()}`
        : sql``;

      // product_salesテーブルを使用
      const onSaleProducts = await db.execute(sql`
        SELECT
          p.id,
          p.title,
          p.normalized_product_id as "normalizedProductId",
          p.default_thumbnail_url as "imageUrl",
          p.release_date as "releaseDate",
          psl.regular_price as "originalPrice",
          psl.sale_price as "salePrice",
          psl.end_at as "saleEndAt",
          COALESCE(psl.discount_percent, 0) as "discountPercent"
        FROM products p
        INNER JOIN product_performers pp ON p.id = pp.product_id
        INNER JOIN product_sources ps ON p.id = ps.product_id
        INNER JOIN product_sales psl ON ps.id = psl.product_source_id
        WHERE pp.performer_id = ${performerId}
          AND psl.is_active = true
          AND psl.end_at > NOW()
          ${aspFilter}
        ORDER BY psl.end_at ASC
        LIMIT ${limit}
      `);

      interface OnSaleProductRow {
        id: number;
        title: string | null;
        normalizedProductId: string | null;
        imageUrl: string | null;
        releaseDate: string | null;
        originalPrice: number | string | null;
        salePrice: number | string;
        saleEndAt: string;
        discountPercent: number | string;
      }

      return (onSaleProducts.rows as OnSaleProductRow[]).map(row => ({
        id: row.id,
        title: row.title || '',
        normalizedProductId: row.normalizedProductId,
        imageUrl: row.imageUrl,
        releaseDate: row.releaseDate,
        originalPrice: row.originalPrice ? Number(row.originalPrice) : null,
        salePrice: Number(row.salePrice),
        saleEndAt: row.saleEndAt,
        discountPercent: Number(row.discountPercent),
      }));
    } catch (error) {
      console.error('Error fetching performer on-sale products:', error);
      return [];
    }
  }

  return {
    getRelatedProducts,
    getWeeklyHighlights,
    getViewingPatternStats,
    getRecommendedActressesFromFavorites,
    getRelatedPerformers,
    getRelatedPerformersWithGenreMatch,
    getRelatedProductsByNames,
    getSimilarActresses,
    getPerformerTopProducts,
    getPerformerOnSaleProducts,
  };
}

// 型エクスポート
export type RecommendationsQueries = ReturnType<typeof createRecommendationsQueries>;
