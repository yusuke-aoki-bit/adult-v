/**
 * 女優リストクエリ
 * getActresses/getActressesCount共通化
 */
import { and, or, desc, asc, sql, inArray, notInArray, eq, type SQL } from 'drizzle-orm';
import type { SiteMode } from './asp-filter';
import { createActressAspFilterCondition } from './asp-filter';

// ============================================================
// Types
// ============================================================

/**
 * 女優ソートオプション
 */
export type ActressSortOption =
  | 'nameAsc'
  | 'nameDesc'
  | 'productCountDesc'
  | 'productCountAsc'
  | 'recent';

/**
 * 女優リスト取得オプション
 */
export interface GetActressesOptions {
  limit?: number;
  offset?: number;
  query?: string;
  ids?: number[];
  includeTags?: string[];
  excludeTags?: string[];
  sortBy?: ActressSortOption;
  excludeInitials?: boolean;
  includeAsps?: string[];
  excludeAsps?: string[];
  hasVideo?: boolean;
  hasImage?: boolean;
  hasReview?: boolean;
  locale?: string;
  // 女優特徴フィルター（fanzaサイト専用）
  cupSizes?: string[];
  heightMin?: number;
  heightMax?: number;
  bloodTypes?: string[];
}

/**
 * 女優カウント取得オプション
 */
export interface GetActressesCountOptions {
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
  excludeInitials?: boolean;
  includeAsps?: string[];
  excludeAsps?: string[];
  hasVideo?: boolean;
  hasImage?: boolean;
  hasReview?: boolean;
  // 女優特徴フィルター（fanzaサイト専用）
  cupSizes?: string[];
  heightMin?: number;
  heightMax?: number;
  bloodTypes?: string[];
}

export interface ActressListQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performerAliases: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productTags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productImages: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productVideos: any;
  /** サイトモード */
  siteMode: SiteMode;
  /** 女優特徴フィルターを有効にするか */
  enableActressFeatureFilter?: boolean;
  /** 女優マッピング関数 */
  mapPerformerToActress: (
    performer: unknown,
    productCount: number,
    thumbnail: string | undefined,
    services: string[] | undefined,
    aliases: string[] | undefined,
    locale: string
  ) => unknown;
  /** バッチでサムネイルを取得 */
  batchGetPerformerThumbnails: (performerIds: number[]) => Promise<Map<number, string>>;
  /** バッチでサービスを取得 */
  batchGetPerformerServices: (performerIds: number[]) => Promise<Map<number, string[]>>;
  /** バッチで別名を取得 */
  batchGetPerformerAliases: (performerIds: number[]) => Promise<Map<number, string[]>>;
  /** キャッシュ取得関数 */
  getFromMemoryCache: <T>(key: string) => T | null;
  /** キャッシュ設定関数 */
  setToMemoryCache: <T>(key: string, value: T) => void;
}

export interface ActressListQueries {
  getActresses: <T>(options?: GetActressesOptions) => Promise<T[]>;
  getActressesCount: (options?: GetActressesCountOptions) => Promise<number>;
}

// ============================================================
// Factory
// ============================================================

/**
 * 女優リストクエリファクトリー
 */
export function createActressListQueries(deps: ActressListQueryDeps): ActressListQueries {
  const {
    getDb,
    performers,
    performerAliases,
    productPerformers,
    productTags,
    productSources,
    productImages,
    productVideos,
    siteMode,
    enableActressFeatureFilter = false,
    mapPerformerToActress,
    batchGetPerformerThumbnails,
    batchGetPerformerServices,
    batchGetPerformerAliases,
    getFromMemoryCache,
    setToMemoryCache,
  } = deps;

  /**
   * 共通フィルター条件を構築
   */
  async function buildConditions(db: ReturnType<typeof getDb>, options?: GetActressesOptions | GetActressesCountOptions): Promise<{ conditions: SQL[]; earlyReturn: boolean }> {
    const conditions: SQL[] = [];

    // サイトモード別ASPフィルタ
    if (siteMode === 'all' && 'ids' in (options || {}) && (options as GetActressesOptions)?.ids && (options as GetActressesOptions).ids!.length > 0) {
      // IDsが指定されている場合は、そのIDのみで絞り込み
      conditions.push(inArray(performers.id, (options as GetActressesOptions).ids!));
    } else {
      // サイトモードに応じたASPフィルタを追加
      conditions.push(createActressAspFilterCondition(performers, siteMode));

      // webサイトのみ: 作品と紐付いている女優のみ表示（出演数0の女優を除外）
      if (siteMode === 'all') {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            WHERE pp.performer_id = ${performers.id}
          )`
        );
      }
    }

    // 'etc'フィルタ: 50音・アルファベット以外で始まる名前
    if (options?.excludeInitials) {
      conditions.push(
        sql`NOT (
          LEFT(${performers.name}, 1) ~ '^[ぁ-んァ-ヴーA-Za-z]'
        )`
      );
    }

    // 対象タグでフィルタ（いずれかを含む）
    if (options?.includeTags && options.includeTags.length > 0) {
      const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(inArray(productTags.tagId, tagIds));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map((p: { performerId: number }) => p.performerId);
          conditions.push(inArray(performers.id, performerIdValues));
        } else {
          return { conditions, earlyReturn: true };
        }
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        const excludedPerformerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productTags)
          .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
          .where(inArray(productTags.tagId, tagIds));

        if (excludedPerformerIds.length > 0) {
          const excludedPerformerIdValues = excludedPerformerIds.map((p: { performerId: number }) => p.performerId);
          conditions.push(notInArray(performers.id, excludedPerformerIdValues));
        }
      }
    }

    // ASPフィルタ（いずれかを含む）
    if (options?.includeAsps && options.includeAsps.length > 0) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productSources)
        .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
        .where(inArray(productSources.aspName, options.includeAsps));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map((p: { performerId: number }) => p.performerId);
        conditions.push(inArray(performers.id, performerIdValues));
      } else {
        return { conditions, earlyReturn: true };
      }
    }

    // ASP除外フィルタ（いずれも含まない）
    if (options?.excludeAsps && options.excludeAsps.length > 0) {
      const excludedPerformerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productSources)
        .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
        .where(inArray(productSources.aspName, options.excludeAsps));

      if (excludedPerformerIds.length > 0) {
        const excludedPerformerIdValues = excludedPerformerIds.map((p: { performerId: number }) => p.performerId);
        conditions.push(notInArray(performers.id, excludedPerformerIdValues));
      }
    }

    // hasVideoフィルタ
    if (options?.hasVideo) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productVideos)
        .innerJoin(productPerformers, eq(productVideos.productId, productPerformers.productId));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map((p: { performerId: number }) => p.performerId);
        conditions.push(inArray(performers.id, performerIdValues));
      } else {
        return { conditions, earlyReturn: true };
      }
    }

    // hasImageフィルタ
    if (options?.hasImage) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productImages)
        .innerJoin(productPerformers, eq(productImages.productId, productPerformers.productId));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map((p: { performerId: number }) => p.performerId);
        conditions.push(inArray(performers.id, performerIdValues));
      } else {
        return { conditions, earlyReturn: true };
      }
    }

    // hasReviewフィルタ
    if (options?.hasReview) {
      conditions.push(sql`${performers.aiReview} IS NOT NULL`);
    }

    // 女優特徴フィルター（enableActressFeatureFilterがtrueの場合のみ）
    if (enableActressFeatureFilter) {
      // カップサイズフィルタ
      if (options?.cupSizes && options.cupSizes.length > 0) {
        conditions.push(
          sql`${performers.cup} IN (${sql.join(options.cupSizes.map(c => sql`${c}`), sql`, `)})`
        );
      }

      // 身長フィルタ（最小）
      if (options?.heightMin !== undefined) {
        conditions.push(sql`${performers.height} >= ${options.heightMin}`);
      }

      // 身長フィルタ（最大）
      if (options?.heightMax !== undefined) {
        conditions.push(sql`${performers.height} <= ${options.heightMax}`);
      }

      // 血液型フィルタ
      if (options?.bloodTypes && options.bloodTypes.length > 0) {
        conditions.push(
          sql`${performers.bloodType} IN (${sql.join(options.bloodTypes.map(b => sql`${b}`), sql`, `)})`
        );
      }
    }

    // 検索クエリ
    if (options?.query) {
      const isInitialSearch = options.query.length === 1;
      const searchPattern = isInitialSearch ? options.query + '%' : '%' + options.query + '%';

      const matchingPerformerIds = await db
        .selectDistinct({ performerId: performerAliases.performerId })
        .from(performerAliases)
        .where(
          or(
            sql`similarity(${performerAliases.aliasName}, ${options.query}) > 0.2`,
            sql`${performerAliases.aliasName} ILIKE ${searchPattern}`
          )!
        );

      // 検索条件を構築
      // getActressesの場合はAIレビュー検索も含める、getActressesCountの場合は含めない
      const isGetActresses = 'limit' in (options || {});
      const nameConditions = isInitialSearch
        ? sql`${performers.nameKana} IS NOT NULL AND ${performers.nameKana} ILIKE ${searchPattern}`
        : isGetActresses
          ? or(
              sql`similarity(${performers.name}, ${options.query}) > 0.2`,
              sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
              sql`${performers.name} ILIKE ${searchPattern}`,
              sql`${performers.nameKana} ILIKE ${searchPattern}`,
              sql`${performers.aiReview} ILIKE ${searchPattern}`
            )!
          : or(
              sql`similarity(${performers.name}, ${options.query}) > 0.2`,
              sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
              sql`${performers.name} ILIKE ${searchPattern}`,
              sql`${performers.nameKana} ILIKE ${searchPattern}`
            )!;

      if (matchingPerformerIds.length > 0) {
        conditions.push(
          or(
            nameConditions,
            inArray(performers.id, matchingPerformerIds.map((p: { performerId: number }) => p.performerId))
          )!
        );
      } else {
        conditions.push(nameConditions);
      }
    }

    return { conditions, earlyReturn: false };
  }

  /**
   * 女優一覧を取得
   */
  async function getActresses<T>(options?: GetActressesOptions): Promise<T[]> {
    try {
      const db = getDb();
      const { conditions, earlyReturn } = await buildConditions(db, options);

      if (earlyReturn) {
        return [];
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const sortBy = options?.sortBy || 'nameAsc';

      let results;

      if (sortBy === 'productCountDesc' || sortBy === 'productCountAsc') {
        results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(
            sortBy === 'productCountDesc'
              ? desc(sql`COALESCE(${performers.releaseCount}, 0)`)
              : asc(sql`COALESCE(${performers.releaseCount}, 0)`),
            desc(performers.id)
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);
      } else if (sortBy === 'recent') {
        // 作品の発売日で女優をソート
        // latestReleaseDateカラムを使用（precomputedカラム）
        results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(
            desc(sql`COALESCE(${performers.latestReleaseDate}, '1900-01-01')`),
            desc(performers.id)
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);
      } else {
        // 名前順
        let orderByClauses;
        switch (sortBy) {
          case 'nameAsc':
            orderByClauses = [asc(sql`COALESCE(${performers.nameKana}, '龠')`), asc(performers.id)];
            break;
          case 'nameDesc':
            orderByClauses = [desc(sql`COALESCE(${performers.nameKana}, '')`), desc(performers.id)];
            break;
          default:
            orderByClauses = [asc(sql`COALESCE(${performers.nameKana}, '龠')`), asc(performers.id)];
        }

        results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(...orderByClauses)
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);
      }

      // バッチでサムネイル、ASPサービス、別名を取得
      const performerIds = results.map((p: { id: number }) => p.id);
      const [thumbnails, servicesMap, aliasesMap] = await Promise.all([
        batchGetPerformerThumbnails(performerIds),
        batchGetPerformerServices(performerIds),
        batchGetPerformerAliases(performerIds),
      ]);

      const locale = options?.locale || 'ja';
      const actresses = results.map((performer: { id: number; releaseCount?: number }) =>
        mapPerformerToActress(
          performer,
          performer.releaseCount || 0,
          thumbnails.get(performer.id),
          servicesMap.get(performer.id),
          aliasesMap.get(performer.id),
          locale
        )
      );

      return actresses as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch actresses: ${errorMessage}`);
    }
  }

  /**
   * 女優の総数を取得
   */
  async function getActressesCount(options?: GetActressesCountOptions): Promise<number> {
    // フィルターの有無をチェック
    const hasFilters = options?.query || options?.includeTags?.length || options?.excludeTags?.length ||
      options?.excludeInitials || options?.includeAsps?.length || options?.excludeAsps?.length ||
      options?.hasVideo || options?.hasImage || options?.hasReview ||
      (enableActressFeatureFilter && (options?.cupSizes?.length || options?.heightMin || options?.heightMax || options?.bloodTypes?.length));

    // キャッシュキーをサイトモードで分ける
    const cacheKey = siteMode === 'fanza-only' ? 'actressesCount:fanza:base' : 'actressesCount:base';

    if (!hasFilters) {
      const cached = getFromMemoryCache<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      const db = getDb();
      const { conditions, earlyReturn } = await buildConditions(db, options);

      if (earlyReturn) {
        return 0;
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(performers)
        .where(whereClause);

      const count = Number(result[0]?.count || 0);

      // フィルターなしの場合はキャッシュに保存
      if (!hasFilters) {
        setToMemoryCache(cacheKey, count);
      }

      return count;
    } catch (error) {
      console.error('Error counting actresses:', error);
      throw error;
    }
  }

  return {
    getActresses,
    getActressesCount,
  };
}
