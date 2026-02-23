/**
 * 統計ページ用のデータベースクエリ
 * SEO対策: 引用されやすいデータを提供
 */

import { db, sql, desc, count, eq, gte, and, isNotNull } from '@adult-v/database';
import { products, performers, productPerformers, productSources, tags, productTags } from '@adult-v/database/schema';

export interface MonthlyReleaseStats {
  month: string;
  releaseCount: number;
}

export interface TopPerformer {
  id: number;
  name: string;
  productCount: number;
}

export interface GenreStats {
  id: number;
  name: string;
  productCount: number;
}

export interface AspStats {
  aspName: string;
  productCount: number;
}

export interface YearlyStats {
  year: number;
  totalProducts: number;
  totalPerformers: number;
}

export interface OverallStats {
  totalProducts: number;
  totalPerformers: number;
  totalGenres: number;
}

/**
 * 月別リリース数の推移（過去24ヶ月）
 */
export async function getMonthlyReleaseStats(months: number = 24): Promise<MonthlyReleaseStats[]> {
  const result = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', release_date), 'YYYY-MM') as month,
      COUNT(*)::int as release_count
    FROM products
    WHERE release_date IS NOT NULL
      AND release_date >= NOW() - INTERVAL '${sql.raw(String(months))} months'
      AND release_date <= NOW()
    GROUP BY DATE_TRUNC('month', release_date)
    ORDER BY month ASC
  `);

  return (result.rows as any[]).map((row) => ({
    month: row.month,
    releaseCount: parseInt(row.release_count, 10),
  }));
}

/**
 * 作品数TOP20女優
 */
export async function getTopPerformersByProductCount(limit: number = 20): Promise<TopPerformer[]> {
  const result = await db
    .select({
      id: performers['id'],
      name: performers['name'],
      productCount: count(productPerformers.productId),
    })
    .from(performers)
    .leftJoin(productPerformers, eq(performers['id'], productPerformers.performerId))
    .groupBy(performers['id'], performers['name'])
    .orderBy(desc(count(productPerformers.productId)))
    .limit(limit);

  return result.map((row) => ({
    id: row['id'],
    name: row['name'],
    productCount: Number(row.productCount),
  }));
}

/**
 * 人気ジャンルTOP20
 */
export async function getTopGenres(limit: number = 20): Promise<GenreStats[]> {
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      productCount: count(productTags.productId),
    })
    .from(tags)
    .innerJoin(productTags, eq(tags.id, productTags.tagId))
    .where(eq(tags.category, 'genre'))
    .groupBy(tags.id, tags.name)
    .orderBy(desc(count(productTags.productId)))
    .limit(limit);

  return result.map((row) => ({
    id: row['id'],
    name: row['name'],
    productCount: Number(row.productCount),
  }));
}

/**
 * ASP別作品数
 */
export async function getAspDistribution(): Promise<AspStats[]> {
  const result = await db
    .select({
      aspName: productSources.aspName,
      productCount: count(productSources.productId),
    })
    .from(productSources)
    .groupBy(productSources.aspName)
    .orderBy(desc(count(productSources.productId)));

  return result.map((row) => ({
    aspName: row['aspName'],
    productCount: Number(row.productCount),
  }));
}

/**
 * 年別統計サマリー
 */
export async function getYearlyStats(): Promise<YearlyStats[]> {
  const result = await db.execute(sql`
    SELECT
      EXTRACT(YEAR FROM release_date)::int as year,
      COUNT(DISTINCT p.id)::int as total_products,
      COUNT(DISTINCT pp.performer_id)::int as total_performers
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE release_date IS NOT NULL
      AND EXTRACT(YEAR FROM release_date) >= 2015
      AND release_date <= NOW()
    GROUP BY EXTRACT(YEAR FROM release_date)
    ORDER BY year DESC
  `);

  return (result.rows as any[]).map((row) => ({
    year: parseInt(row.year, 10),
    totalProducts: parseInt(row.total_products, 10),
    totalPerformers: parseInt(row.total_performers, 10),
  }));
}

/**
 * 全体統計サマリー
 */
export async function getOverallStats(): Promise<OverallStats> {
  const [productCountResult, performerCountResult, genreCountResult] = await Promise.all([
    db['select']({ count: count() }).from(products),
    db['select']({ count: count() }).from(performers),
    db['select']({ count: count() }).from(tags).where(eq(tags.category, 'genre')),
  ]);

  return {
    totalProducts: Number(productCountResult[0]?.count || 0),
    totalPerformers: Number(performerCountResult[0]?.count || 0),
    totalGenres: Number(genreCountResult[0]?.count || 0),
  };
}

/**
 * 今月の新作数
 */
export async function getCurrentMonthReleases(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(products)
    .where(and(isNotNull(products['releaseDate']), gte(products['releaseDate'], sql`DATE_TRUNC('month', NOW())`)));

  return Number(result[0]?.count || 0);
}

/**
 * 新人女優数（今年デビュー）
 */
export async function getNewPerformersThisYear(): Promise<number> {
  const currentYear = new Date().getFullYear();
  const result = await db.select({ count: count() }).from(performers).where(eq(performers['debutYear'], currentYear));

  return Number(result[0]?.count || 0);
}

// ========== 追加統計クエリ ==========

export interface MakerStats {
  makerId: number;
  makerName: string;
  productCount: number;
  sharePercent: number;
}

export interface GenreTrend {
  genreId: number;
  genreName: string;
  months: { month: string; count: number }[];
}

export interface DebutStats {
  year: number;
  debutCount: number;
}

export interface DailyRelease {
  date: string;
  releaseCount: number;
  products: { id: number; title: string; normalizedProductId: string | null }[];
}

export interface CalendarProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  thumbnailUrl: string | null;
  releaseDate: string;
}

export interface CalendarPerformer {
  id: number;
  name: string;
  nameReading: string | null;
  imageUrl: string | null;
  productCount: number;
}

export interface CalendarDayData {
  date: string;
  releaseCount: number;
  products: CalendarProduct[];
  performers: CalendarPerformer[];
}

/**
 * メーカー別シェア（TOP20）
 * メーカー情報はtagsテーブルのcategory='maker'から取得
 */
export async function getMakerShareStats(limit: number = 20): Promise<MakerStats[]> {
  const result = await db.execute(sql`
    WITH maker_counts AS (
      SELECT
        t.id as maker_id,
        t.name as maker_name,
        COUNT(DISTINCT pt.product_id)::int as product_count
      FROM tags t
      INNER JOIN product_tags pt ON pt.tag_id = t.id
      WHERE t.category = 'maker'
      GROUP BY t.id, t.name
    ),
    total AS (
      SELECT SUM(product_count)::numeric as total_count FROM maker_counts
    )
    SELECT
      mc.maker_id,
      mc.maker_name,
      mc.product_count,
      ROUND((mc.product_count::numeric / NULLIF(t.total_count, 0) * 100), 2) as share_percent
    FROM maker_counts mc, total t
    ORDER BY mc.product_count DESC
    LIMIT ${limit}
  `);

  return (result.rows as any[]).map((row) => ({
    makerId: parseInt(row.maker_id, 10),
    makerName: row.maker_name,
    productCount: parseInt(row.product_count, 10),
    sharePercent: parseFloat(row.share_percent || '0'),
  }));
}

/**
 * ジャンル別月間トレンド（過去12ヶ月、TOP10ジャンル）
 */
export async function getGenreTrends(months: number = 12, topGenres: number = 10): Promise<GenreTrend[]> {
  const result = await db.execute(sql`
    WITH top_genres AS (
      SELECT t.id, t.name
      FROM tags t
      INNER JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.category = 'genre'
      GROUP BY t.id, t.name
      ORDER BY COUNT(*) DESC
      LIMIT ${topGenres}
    ),
    monthly_counts AS (
      SELECT
        tg.id as genre_id,
        tg.name as genre_name,
        TO_CHAR(DATE_TRUNC('month', p.release_date), 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM top_genres tg
      INNER JOIN product_tags pt ON tg.id = pt.tag_id
      INNER JOIN products p ON pt.product_id = p.id
      WHERE p.release_date IS NOT NULL
        AND p.release_date >= NOW() - INTERVAL '${sql.raw(String(months))} months'
        AND p.release_date <= NOW()
      GROUP BY tg.id, tg.name, DATE_TRUNC('month', p.release_date)
    )
    SELECT genre_id, genre_name, month, count
    FROM monthly_counts
    ORDER BY genre_id, month
  `);

  // ジャンルごとにグループ化
  const genreMap = new Map<number, GenreTrend>();
  for (const row of result.rows as any[]) {
    const genreId = parseInt(row.genre_id, 10);
    if (!genreMap.has(genreId)) {
      genreMap.set(genreId, {
        genreId,
        genreName: row.genre_name,
        months: [],
      });
    }
    genreMap.get(genreId)!.months.push({
      month: row.month,
      count: parseInt(row['count'], 10),
    });
  }

  return Array.from(genreMap.values());
}

/**
 * 年別新人デビュー数推移
 * 各女優の最初の出演作品のリリース年をデビュー年として計算
 */
export async function getDebutTrends(years: number = 10): Promise<DebutStats[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years + 1;

  const result = await db.execute(sql`
    WITH performer_debuts AS (
      SELECT
        pp.performer_id,
        EXTRACT(YEAR FROM MIN(p.release_date))::int as debut_year
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
      WHERE p.release_date IS NOT NULL
      GROUP BY pp.performer_id
    )
    SELECT
      debut_year as year,
      COUNT(*)::int as debut_count
    FROM performer_debuts
    WHERE debut_year >= ${startYear}
      AND debut_year <= ${currentYear}
    GROUP BY debut_year
    ORDER BY debut_year ASC
  `);

  return (result.rows as any[]).map((row) => ({
    year: parseInt(row.year, 10),
    debutCount: parseInt(row.debut_count, 10),
  }));
}

/**
 * 日別リリース情報（カレンダー用）
 */
export async function getDailyReleases(year: number, month: number): Promise<DailyRelease[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const result = await db.execute(sql`
    SELECT
      TO_CHAR(release_date, 'YYYY-MM-DD') as date,
      COUNT(*)::int as release_count,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', id,
          'title', title,
          'normalizedProductId', normalized_product_id
        )
        ORDER BY id
      ) FILTER (WHERE id IS NOT NULL) as products
    FROM products
    WHERE release_date >= ${startDate}
      AND release_date < ${endDate}
    GROUP BY TO_CHAR(release_date, 'YYYY-MM-DD')
    ORDER BY date
  `);

  return (result.rows as any[]).map((row) => ({
    date: row.date,
    releaseCount: parseInt(row.release_count, 10),
    products: (row.products || []).slice(0, 10), // 最大10件
  }));
}

/**
 * カレンダー用詳細データ取得（商品・女優カード表示用）
 * 各日に対してランダムな商品と女優を取得
 */
export async function getCalendarDetailData(
  year: number,
  month: number,
  productsPerDay: number = 4,
  performersPerDay: number = 2,
): Promise<CalendarDayData[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // 日別の実際のリリース数を取得（全商品を対象）
  const dailyCountsResult = await db.execute(sql`
    SELECT
      TO_CHAR(release_date, 'YYYY-MM-DD') as date,
      COUNT(*)::int as release_count
    FROM products
    WHERE release_date >= ${startDate}
      AND release_date < ${endDate}
    GROUP BY TO_CHAR(release_date, 'YYYY-MM-DD')
  `);

  // 日別カウントのマップを作成
  const dailyCountsMap = new Map<string, number>();
  for (const row of dailyCountsResult.rows as any[]) {
    dailyCountsMap.set(row.date, parseInt(row.release_count, 10));
  }

  // 日別のリリース商品を取得（ランダム選択、サムネイルありのみ）
  const productsResult = await db.execute(sql`
    WITH daily_products AS (
      SELECT
        TO_CHAR(release_date, 'YYYY-MM-DD') as date,
        id,
        title,
        normalized_product_id,
        default_thumbnail_url,
        release_date,
        ROW_NUMBER() OVER (
          PARTITION BY TO_CHAR(release_date, 'YYYY-MM-DD')
          ORDER BY RANDOM()
        ) as rn
      FROM products
      WHERE release_date >= ${startDate}
        AND release_date < ${endDate}
        AND default_thumbnail_url IS NOT NULL
    )
    SELECT
      date,
      id,
      title,
      normalized_product_id,
      default_thumbnail_url as thumbnail_url,
      TO_CHAR(release_date, 'YYYY-MM-DD') as release_date_str
    FROM daily_products
    WHERE rn <= ${productsPerDay}
    ORDER BY date, rn
  `);

  // 日別の出演女優を取得（その日リリースの商品に出演している女優からランダム選択）
  const performersResult = await db.execute(sql`
    WITH performer_counts AS (
      SELECT
        TO_CHAR(p.release_date, 'YYYY-MM-DD') as date,
        perf.id,
        perf.name,
        perf.name_kana,
        perf.profile_image_url,
        COUNT(DISTINCT p.id) as product_count
      FROM products p
      INNER JOIN product_performers pp ON p.id = pp.product_id
      INNER JOIN performers perf ON pp.performer_id = perf.id
      WHERE p.release_date >= ${startDate}
        AND p.release_date < ${endDate}
        AND perf.profile_image_url IS NOT NULL
      GROUP BY TO_CHAR(p.release_date, 'YYYY-MM-DD'), perf.id, perf.name, perf.name_kana, perf.profile_image_url
    ),
    ranked_performers AS (
      SELECT
        date,
        id,
        name,
        name_kana,
        profile_image_url,
        product_count,
        ROW_NUMBER() OVER (
          PARTITION BY date
          ORDER BY RANDOM()
        ) as rn
      FROM performer_counts
    )
    SELECT
      date,
      id,
      name,
      name_kana as name_reading,
      profile_image_url as image_url,
      product_count::int
    FROM ranked_performers
    WHERE rn <= ${performersPerDay}
    ORDER BY date, rn
  `);

  // 日付ごとにグループ化
  const dateMap = new Map<string, CalendarDayData>();

  // まず、全ての日別カウントからエントリを作成
  for (const [date, count] of dailyCountsMap) {
    dateMap.set(date, {
      date,
      releaseCount: count,
      products: [],
      performers: [],
    });
  }

  // 商品データを追加
  for (const row of productsResult.rows as any[]) {
    const date = row.date;
    if (!dateMap.has(date)) {
      // サムネイルありの商品はあるがカウントマップにない場合（通常ありえない）
      dateMap.set(date, {
        date,
        releaseCount: 1,
        products: [],
        performers: [],
      });
    }
    dateMap.get(date)!.products.push({
      id: row['id'],
      title: row['title'],
      normalizedProductId: row.normalized_product_id,
      thumbnailUrl: row.thumbnail_url,
      releaseDate: row.release_date_str,
    });
  }

  // 女優データを追加
  for (const row of performersResult.rows as any[]) {
    const date = row.date;
    if (!dateMap.has(date)) {
      dateMap.set(date, {
        date,
        releaseCount: dailyCountsMap.get(date) || 0,
        products: [],
        performers: [],
      });
    }
    dateMap.get(date)!.performers.push({
      id: row['id'],
      name: row['name'],
      nameReading: row.name_reading,
      imageUrl: row.image_url,
      productCount: row.product_count,
    });
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
