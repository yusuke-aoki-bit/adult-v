/**
 * 共有女優DBクエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, sql, inArray, desc, asc } from 'drizzle-orm';
import { logDbErrorAndReturn, logDbErrorAndThrow, logDbWarning } from '../lib/db-logger';

// ============================================================
// Types
// ============================================================

// Note: DI型でanyを使用するのは意図的 - Drizzle ORMの具象型はアプリ固有のため
export interface ActressQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performerAliases: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products?: any;
  /** Function to map DB performer to ActressType (sync version for simple cases) */
  mapPerformerToActress: (performer: unknown, locale: string) => unknown;
  /** Function to map DB performer to ActressType (async version with additional data) */
  mapPerformerToActressAsync?: (performer: unknown, locale: string) => Promise<unknown>;
  /** Function to get localized performer name */
  getLocalizedPerformerName?: (performer: unknown, locale: string) => string;
  /** Function to get actress by ID - DEPRECATED: use batch functions for lists */
  getActressById?: (id: string, locale?: string) => Promise<unknown | null>;
  /** Batch function to get thumbnails for multiple performers (N+1解消用) */
  batchGetPerformerThumbnails?: (performerIds: number[]) => Promise<Map<number, string>>;
  /** Batch function to get services for multiple performers (N+1解消用) */
  batchGetPerformerServices?: (performerIds: number[]) => Promise<Map<number, string[]>>;
  /** Batch function to get aliases for multiple performers (N+1解消用) */
  batchGetPerformerAliases?: (performerIds: number[]) => Promise<Map<number, string[]>>;
  /** Function to map performer with batch data to ActressType (N+1解消用) */
  mapPerformerWithBatchData?: (
    performer: unknown,
    thumbnailUrl: string | undefined,
    services: string[] | undefined,
    aliases: string[] | undefined,
    productCount: number,
    locale: string
  ) => unknown;
}

export interface PerformerAlias {
  id: number;
  aliasName: string;
  source: string | null;
}

export interface SiteProductCount {
  site: string;
  count: number;
}

export interface AspProductCount {
  aspName: string;
  count: number;
}

/**
 * キャリア分析結果
 */
export interface CareerAnalysis {
  debutYear: number | null;
  latestYear: number | null;
  debutProduct: { id: number; title: string; releaseDate: string } | null;
  latestProduct: { id: number; title: string; releaseDate: string } | null;
  totalProducts: number;
  yearlyStats: Array<{
    year: number;
    count: number;
    products: Array<{ id: number; title: string; releaseDate: string }>;
  }>;
  peakYear: number | null;
  peakYearCount: number;
  isActive: boolean; // 過去6ヶ月以内にリリースがあるか
  monthsSinceLastRelease: number | null;
  averageProductsPerYear: number;
}

// ============================================================
// Factory
// ============================================================

/**
 * 女優クエリファクトリー
 */
export function createActressQueries(deps: ActressQueryDeps) {
  const {
    getDb,
    performers,
    performerAliases,
    productPerformers,
    productSources,
    products,
    mapPerformerToActress,
    mapPerformerToActressAsync,
    getActressById: getActressByIdFn,
    batchGetPerformerThumbnails,
    batchGetPerformerServices,
    batchGetPerformerAliases,
    mapPerformerWithBatchData,
  } = deps;

  /**
   * 女優IDで女優を取得
   * 非同期マッパーが提供されている場合はそちらを使用（サムネイルやサービス一覧などの追加データを取得）
   */
  async function getActressById<T>(id: string, locale: string = 'ja'): Promise<T | null> {
    try {
      const db = getDb();

      const result = await db
        .select()
        .from(performers)
        .where(eq(performers['id'], parseInt(id)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // 非同期マッパーが提供されている場合はそちらを優先
      if (mapPerformerToActressAsync) {
        return (await mapPerformerToActressAsync(result[0], locale)) as T;
      }

      return mapPerformerToActress(result[0], locale) as T;
    } catch (error) {
      logDbErrorAndThrow(error, 'getActressById', { actressId: id });
    }
  }

  /**
   * 演者の別名を取得
   */
  async function getPerformerAliases(performerId: number): Promise<PerformerAlias[]> {
    const db = getDb();

    const aliases = await db
      .select({
        id: performerAliases.id,
        aliasName: performerAliases.aliasName,
        source: performerAliases.source,
      })
      .from(performerAliases)
      .where(eq(performerAliases.performerId, performerId));

    // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
    return aliases.map((a: Record<string, unknown>) => ({
      id: a['id'] as number,
      aliasName: a['aliasName'] as string,
      source: a['source'] as string | null,
    }));
  }

  /**
   * 女優の出演作品数をサイト別に取得
   */
  async function getActressProductCountBySite(actressId: string): Promise<SiteProductCount[]> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN ps.asp_name IN ('CARIBBEAN', 'CARIBBEANCOMPR', '1PONDO', 'HEYZO', '10MUSUME',
                               'PACOPACOMAMA', 'H4610', 'H0930', 'C0930', 'GACHINCO',
                               'KIN8TENGOKU', 'NYOSHIN', 'HEYDOUGA', 'X1X', 'ENKOU55',
                               'UREKKO', 'XXXURABI', 'TOKYOHOT') THEN 'dti'
          WHEN ps.asp_name = 'DUGA' THEN 'duga'
          WHEN ps.asp_name = 'SOKMIL' THEN 'sokmil'
          WHEN ps.asp_name = 'MGS' THEN 'mgs'
          WHEN ps.asp_name = 'FANZA' THEN 'fanza'
          WHEN ps.asp_name = 'FC2' THEN 'fc2'
          ELSE 'other'
        END as site,
        COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
      GROUP BY site
      ORDER BY count DESC
    `);

    return (result.rows as { site: string; count: string | number }[]).map((row) => ({
      site: row.site,
      count: typeof row['count'] === 'string' ? parseInt(row['count']) : row['count'],
    }));
  }

  /**
   * 女優の出演作品数をASP別に取得
   */
  async function getActressProductCountByAsp(actressId: string): Promise<AspProductCount[]> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        ps.asp_name as "aspName",
        COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
      GROUP BY ps.asp_name
      ORDER BY count DESC
    `);

    return (result.rows as { aspName: string; count: string | number }[]).map((row) => ({
      aspName: row['aspName'],
      count: typeof row['count'] === 'string' ? parseInt(row['count']) : row['count'],
    }));
  }

  /**
   * 女優の平均価格/分を取得
   */
  async function getActressAvgPricePerMin(actressId: string): Promise<number | null> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        AVG(ps.price / NULLIF(p.duration, 0)) as avg_price_per_min
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
        AND ps.price IS NOT NULL
        AND ps.price > 0
        AND p.duration IS NOT NULL
        AND p.duration > 0
    `);

    if (result.rows.length === 0) return null;

    const avgPricePerMin = (result.rows[0] as { avg_price_per_min: string | number | null })
      .avg_price_per_min;

    if (avgPricePerMin === null) return null;

    return typeof avgPricePerMin === 'string'
      ? parseFloat(avgPricePerMin)
      : avgPricePerMin;
  }

  /**
   * 新作が出た女優を取得（最近リリースされた商品に出演している女優）
   * バッチ関数が提供されている場合はN+1を回避してバッチ処理
   * @param getActressByIdCallback - 外部から渡すgetActressById関数（後方互換用、バッチ関数推奨）
   */
  async function getActressesWithNewReleases<T>(options: {
    limit?: number;
    daysAgo?: number;
    locale?: string;
    getActressByIdCallback?: (id: string, locale?: string) => Promise<T | null>;
  } = {}): Promise<T[]> {
    const { limit = 20, daysAgo = 30, locale = 'ja', getActressByIdCallback } = options;

    try {
      const db = getDb();

      // 指定期間内にリリースされた商品を取得し、その出演者をユニークに取得
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - daysAgo);
      const recentDateStr = recentDate.toISOString().split('T')[0];

      // 女優情報と作品数を一括取得
      interface ActressWithNewReleasesRow {
        id: number;
        name: string;
        name_kana: string | null;
        name_en: string | null;
        name_zh: string | null;
        name_ko: string | null;
        bio: string | null;
        bio_en: string | null;
        bio_zh: string | null;
        bio_ko: string | null;
        profile_image_url: string | null;
        latest_release_date: string;
        product_count: string;
      }

      const result = await db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.name_kana,
          p.name_en,
          p.name_zh,
          p.name_ko,
          p.bio,
          p.bio_en,
          p.bio_zh,
          p.bio_ko,
          p.profile_image_url,
          MAX(pr.release_date)::text as latest_release_date,
          COUNT(DISTINCT pr.id)::text as product_count
        FROM performers p
        INNER JOIN product_performers pp ON p.id = pp.performer_id
        INNER JOIN products pr ON pp.product_id = pr.id
        WHERE pr.release_date >= ${recentDateStr}::date
        GROUP BY p.id, p.name, p.name_kana, p.name_en, p.name_zh, p.name_ko,
                 p.bio, p.bio_en, p.bio_zh, p.bio_ko, p.profile_image_url
        ORDER BY MAX(pr.release_date) DESC
        LIMIT ${limit}
      `);

      if (!result || !result.rows || !Array.isArray(result.rows)) {
        logDbWarning('No rows returned from query', 'getActressesWithNewReleases');
        return [];
      }

      const rows = result.rows as unknown as ActressWithNewReleasesRow[];
      if (rows.length === 0) return [];

      // バッチ関数が提供されている場合はN+1を回避
      if (batchGetPerformerThumbnails && batchGetPerformerServices && mapPerformerWithBatchData) {
        const performerIds = rows.map(r => r.id);

        // バッチで関連データを取得（3クエリで済む）
        const [thumbnailsMap, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(performerIds),
          batchGetPerformerServices(performerIds),
          batchGetPerformerAliases ? batchGetPerformerAliases(performerIds) : Promise.resolve(new Map<number, string[]>()),
        ]);

        // 各女優をマッピング（N回のDB呼び出しなし）
        return rows.map(row => {
          const performer = {
            id: row['id'],
            name: row['name'],
            nameKana: row.name_kana,
            nameEn: row.name_en,
            nameZh: row.name_zh,
            nameKo: row.name_ko,
            bio: row.bio,
            bioEn: row.bio_en,
            bioZh: row.bio_zh,
            bioKo: row.bio_ko,
            profileImageUrl: row.profile_image_url,
          };
          return mapPerformerWithBatchData(
            performer,
            thumbnailsMap.get(row['id']),
            servicesMap.get(row['id']),
            aliasesMap.get(row['id']),
            parseInt(row.product_count, 10),
            locale
          ) as T;
        });
      }

      // 後方互換: getActressByIdを使用（N+1発生）
      const fetchActress = getActressByIdCallback || getActressByIdFn;
      if (!fetchActress) {
        throw new Error('Either batch functions or getActressById is required');
      }

      const actressesWithDetails = await Promise.all(
        rows.map(async (actress) => {
          const fullActress = await fetchActress(actress['id'].toString(), locale);
          if (fullActress) {
            return fullActress as T;
          }
          return {
            id: actress['id'].toString(),
            name: actress['name'],
            catchcopy: '',
            description: '',
            heroImage: '',
            thumbnail: '',
            primaryGenres: [],
            services: [],
            metrics: {
              releaseCount: parseInt(actress.product_count, 10),
              trendingScore: 0,
              fanScore: 0,
            },
            highlightWorks: [],
            tags: [],
          } as T;
        })
      );

      return actressesWithDetails;
    } catch (error) {
      logDbErrorAndThrow(error, 'getActressesWithNewReleases');
    }
  }

  /**
   * 女優のキャリア分析データを取得
   * 年別の作品数、デビュー作、最新作、全盛期などを分析
   */
  async function getActressCareerAnalysis(actressId: string): Promise<CareerAnalysis | null> {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);
      if (isNaN(performerId)) return null;

      // 年別の作品数を取得
      const yearlyResult = await db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM p.release_date)::int as year,
          COUNT(*)::int as count,
          json_agg(
            json_build_object(
              'id', p.id,
              'title', p.title,
              'releaseDate', p.release_date
            ) ORDER BY p.release_date
          ) as products
        FROM products p
        JOIN product_performers pp ON p.id = pp.product_id
        WHERE pp.performer_id = ${performerId}
          AND p.release_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM p.release_date)
        ORDER BY year
      `);

      if (!yearlyResult.rows || yearlyResult.rows.length === 0) {
        return null;
      }

      type YearlyStat = {
        year: number;
        count: number;
        products: Array<{ id: number; title: string; releaseDate: string }>;
      };

      const yearlyStats: YearlyStat[] = yearlyResult.rows.map((row: Record<string, unknown>) => ({
        year: row['year'] as number,
        count: row['count'] as number,
        products: (row['products'] as Array<{ id: number; title: string; releaseDate: string }>).slice(0, 5), // 各年最大5件
      }));

      // 全盛期（最も作品数が多い年）
      const peakYearData = yearlyStats.length > 0
        ? yearlyStats.reduce((max: YearlyStat, curr: YearlyStat) =>
            curr.count > max.count ? curr : max, yearlyStats[0]!)
        : null;

      // デビュー作と最新作
      const firstYear = yearlyStats[0];
      const lastYear = yearlyStats[yearlyStats.length - 1];
      const debutProduct = firstYear?.products[0] || null;
      const latestProduct = lastYear?.products[lastYear.products.length - 1] || null;

      // 総作品数
      const totalProducts = yearlyStats.reduce((sum: number, y: YearlyStat) => sum + y.count, 0);

      // 活動期間（年数）
      const activeYears = yearlyStats.length;
      const averageProductsPerYear = activeYears > 0 ? totalProducts / activeYears : 0;

      // 最終リリースからの経過月数
      let monthsSinceLastRelease: number | null = null;
      let isActive = false;
      if (latestProduct?.releaseDate) {
        const lastDate = new Date(latestProduct.releaseDate);
        const now = new Date();
        monthsSinceLastRelease = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        isActive = monthsSinceLastRelease <= 6;
      }

      return {
        debutYear: firstYear?.year || null,
        latestYear: lastYear?.year || null,
        debutProduct,
        latestProduct,
        totalProducts,
        yearlyStats,
        peakYear: peakYearData?.year || null,
        peakYearCount: peakYearData?.count || 0,
        isActive,
        monthsSinceLastRelease,
        averageProductsPerYear: Math.round(averageProductsPerYear * 10) / 10,
      };
    } catch (error) {
      return logDbErrorAndReturn(error, null, 'getActressCareerAnalysis', { actressId });
    }
  }

  /**
   * 複数ASPに出演している女優を取得
   * バッチ関数が提供されている場合はN+1を回避
   * @param options.limit - 取得件数（デフォルト20）
   * @param options.minAspCount - 最低何ASP以上に出演しているか（デフォルト2）
   * @param options.locale - ロケール（デフォルト'ja'）
   */
  async function getMultiAspActresses<T>(options: {
    limit?: number;
    minAspCount?: number;
    locale?: string;
  } = {}): Promise<T[]> {
    const { limit = 20, minAspCount = 2, locale = 'ja' } = options;

    try {
      const db = getDb();

      // 複数ASPに商品がある女優を取得（女優情報も一括取得）
      interface MultiAspActressRow {
        performer_id: number;
        name: string;
        name_kana: string | null;
        name_en: string | null;
        name_zh: string | null;
        name_ko: string | null;
        bio: string | null;
        bio_en: string | null;
        bio_zh: string | null;
        bio_ko: string | null;
        profile_image_url: string | null;
        asp_count: string;
        total_products: string;
      }

      const result = await db.execute(sql`
        WITH performer_asp_stats AS (
          SELECT
            pp.performer_id,
            COUNT(DISTINCT ps.asp_name) as asp_count,
            COUNT(DISTINCT pp.product_id) as total_products
          FROM product_performers pp
          INNER JOIN product_sources ps ON pp.product_id = ps.product_id
          WHERE ps.asp_name IS NOT NULL
            AND ps.asp_name != 'DTI'
          GROUP BY pp.performer_id
          HAVING COUNT(DISTINCT ps.asp_name) >= ${minAspCount}
        )
        SELECT
          pas.performer_id,
          p.name,
          p.name_kana,
          p.name_en,
          p.name_zh,
          p.name_ko,
          p.bio,
          p.bio_en,
          p.bio_zh,
          p.bio_ko,
          p.profile_image_url,
          pas.asp_count,
          pas.total_products
        FROM performer_asp_stats pas
        INNER JOIN performers p ON pas.performer_id = p.id
        ORDER BY pas.asp_count DESC, pas.total_products DESC
        LIMIT ${limit}
      `);

      if (!result.rows || result.rows.length === 0) {
        return [];
      }

      const rows = result.rows as unknown as MultiAspActressRow[];

      // バッチ関数が提供されている場合はN+1を回避
      if (batchGetPerformerThumbnails && batchGetPerformerServices && mapPerformerWithBatchData) {
        const performerIds = rows.map(r => r.performer_id);

        const [thumbnailsMap, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(performerIds),
          batchGetPerformerServices(performerIds),
          batchGetPerformerAliases ? batchGetPerformerAliases(performerIds) : Promise.resolve(new Map<number, string[]>()),
        ]);

        return rows.map(row => {
          const performer = {
            id: row.performer_id,
            name: row['name'],
            nameKana: row.name_kana,
            nameEn: row.name_en,
            nameZh: row.name_zh,
            nameKo: row.name_ko,
            bio: row.bio,
            bioEn: row.bio_en,
            bioZh: row.bio_zh,
            bioKo: row.bio_ko,
            profileImageUrl: row.profile_image_url,
          };
          return mapPerformerWithBatchData(
            performer,
            thumbnailsMap.get(row.performer_id),
            servicesMap.get(row.performer_id),
            aliasesMap.get(row.performer_id),
            parseInt(row.total_products, 10),
            locale
          ) as T;
        });
      }

      // 後方互換: getActressByIdを使用（N+1発生）
      const fetchActress = getActressByIdFn;
      if (!fetchActress) {
        throw new Error('Either batch functions or getActressById is required');
      }

      const actresses = await Promise.all(
        rows.map(async (row) => {
          const fullActress = await fetchActress(row.performer_id.toString());
          return fullActress;
        })
      );

      return actresses.filter((a): a is T => a !== null);
    } catch (error) {
      return logDbErrorAndReturn(error, [], 'getMultiAspActresses');
    }
  }

  /**
   * ASP別人気女優を取得
   * バッチ関数が提供されている場合はN+1を回避
   * @param options['aspName'] - ASP名
   * @param options.limit - 取得件数（デフォルト10）
   * @param options.locale - ロケール（デフォルト'ja'）
   */
  async function getActressesByAsp<T>(options: {
    aspName: string;
    limit?: number;
    locale?: string;
  } = { aspName: 'DUGA' }): Promise<T[]> {
    const { aspName, limit = 10, locale = 'ja' } = options;

    try {
      const db = getDb();

      // 指定ASPで作品数が多い女優を取得（女優情報も一括取得）
      interface AspActressRow {
        performer_id: number;
        name: string;
        name_kana: string | null;
        name_en: string | null;
        name_zh: string | null;
        name_ko: string | null;
        bio: string | null;
        bio_en: string | null;
        bio_zh: string | null;
        bio_ko: string | null;
        profile_image_url: string | null;
        product_count: string;
      }

      const result = await db.execute(sql`
        SELECT
          pp.performer_id,
          p.name,
          p.name_kana,
          p.name_en,
          p.name_zh,
          p.name_ko,
          p.bio,
          p.bio_en,
          p.bio_zh,
          p.bio_ko,
          p.profile_image_url,
          COUNT(DISTINCT pp.product_id)::text as product_count
        FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        INNER JOIN performers p ON pp.performer_id = p.id
        WHERE ps.asp_name = ${aspName}
        GROUP BY pp.performer_id, p.id, p.name, p.name_kana, p.name_en, p.name_zh, p.name_ko,
                 p.bio, p.bio_en, p.bio_zh, p.bio_ko, p.profile_image_url
        ORDER BY COUNT(DISTINCT pp.product_id) DESC
        LIMIT ${limit}
      `);

      if (!result.rows || result.rows.length === 0) {
        return [];
      }

      const rows = result.rows as unknown as AspActressRow[];

      // バッチ関数が提供されている場合はN+1を回避
      if (batchGetPerformerThumbnails && batchGetPerformerServices && mapPerformerWithBatchData) {
        const performerIds = rows.map(r => r.performer_id);

        const [thumbnailsMap, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(performerIds),
          batchGetPerformerServices(performerIds),
          batchGetPerformerAliases ? batchGetPerformerAliases(performerIds) : Promise.resolve(new Map<number, string[]>()),
        ]);

        return rows.map(row => {
          const performer = {
            id: row.performer_id,
            name: row['name'],
            nameKana: row.name_kana,
            nameEn: row.name_en,
            nameZh: row.name_zh,
            nameKo: row.name_ko,
            bio: row.bio,
            bioEn: row.bio_en,
            bioZh: row.bio_zh,
            bioKo: row.bio_ko,
            profileImageUrl: row.profile_image_url,
          };
          return mapPerformerWithBatchData(
            performer,
            thumbnailsMap.get(row.performer_id),
            servicesMap.get(row.performer_id),
            aliasesMap.get(row.performer_id),
            parseInt(row.product_count, 10),
            locale
          ) as T;
        });
      }

      // 後方互換: getActressByIdを使用（N+1発生）
      const fetchActress = getActressByIdFn;
      if (!fetchActress) {
        throw new Error('Either batch functions or getActressById is required');
      }

      const actresses = await Promise.all(
        rows.map(async (row) => {
          const fullActress = await fetchActress(row.performer_id.toString());
          return fullActress;
        })
      );

      return actresses.filter((a): a is T => a !== null);
    } catch (error) {
      return logDbErrorAndReturn(error, [], 'getActressesByAsp', { aspName });
    }
  }

  return {
    getActressById,
    getPerformerAliases,
    getActressProductCountBySite,
    getActressProductCountByAsp,
    getActressAvgPricePerMin,
    getActressesWithNewReleases,
    getActressCareerAnalysis,
    getMultiAspActresses,
    getActressesByAsp,
  };
}

export type ActressQueries = ReturnType<typeof createActressQueries>;
