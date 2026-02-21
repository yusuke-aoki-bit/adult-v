/**
 * 女優リストクエリ
 * getActresses/getActressesCount共通化
 */
import { and, or, desc, asc, sql, inArray, type SQL } from 'drizzle-orm';
import type { SiteMode } from './asp-filter';
import { createActressAspFilterCondition } from './asp-filter';
import { extractIds } from '../lib/type-guards';
import { logDbErrorAndThrow } from '../lib/db-logger';

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
  debutYearRange?: string; // e.g. '2024-', '2020-2023', '-2009'
  minWorks?: number;
  onSale?: boolean;
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
  debutYearRange?: string;
  minWorks?: number;
  onSale?: boolean;
}

// Note: DI型でanyを使用するのは意図的 - Drizzle ORMの具象型はアプリ固有のため
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
   * EXISTS サブクエリを使用し、フィルター毎の個別クエリを排除
   */
  function buildConditions(options?: GetActressesOptions | GetActressesCountOptions): { conditions: SQL[] } {
    const conditions: SQL[] = [];

    // サイトモード別ASPフィルタ
    if (siteMode === 'all' && 'ids' in (options || {}) && (options as GetActressesOptions)?.ids && (options as GetActressesOptions).ids!.length > 0) {
      conditions.push(inArray(performers['id'], (options as GetActressesOptions).ids!));
    } else {
      conditions.push(createActressAspFilterCondition(performers, siteMode));

      if (siteMode === 'all') {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            WHERE pp.performer_id = ${performers['id']}
          )`
        );
      }
    }

    // 'etc'フィルタ: 50音・アルファベット以外で始まる名前
    if (options?.excludeInitials) {
      conditions.push(
        sql`NOT (
          LEFT(${performers['name']}, 1) ~ '^[ぁ-んァ-ヴーA-Za-z]'
        )`
      );
    }

    // 対象タグでフィルタ（EXISTS サブクエリ）
    if (options?.includeTags && options.includeTags.length > 0) {
      const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            JOIN ${productTags} pt ON pp.product_id = pt.product_id
            WHERE pp.performer_id = ${performers['id']}
            AND pt.tag_id IN (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // 除外タグでフィルタ（NOT EXISTS サブクエリ）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            JOIN ${productTags} pt ON pp.product_id = pt.product_id
            WHERE pp.performer_id = ${performers['id']}
            AND pt.tag_id IN (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // ASPフィルタ（EXISTS サブクエリ）
    if (options?.includeAsps && options.includeAsps.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productPerformers} pp
          JOIN ${productSources} ps ON pp.product_id = ps.product_id
          WHERE pp.performer_id = ${performers['id']}
          AND ps.asp_name IN (${sql.join(options.includeAsps.map(a => sql`${a}`), sql`, `)})
        )`
      );
    }

    // ASP除外フィルタ（NOT EXISTS サブクエリ）
    if (options?.excludeAsps && options.excludeAsps.length > 0) {
      conditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productPerformers} pp
          JOIN ${productSources} ps ON pp.product_id = ps.product_id
          WHERE pp.performer_id = ${performers['id']}
          AND ps.asp_name IN (${sql.join(options.excludeAsps.map(a => sql`${a}`), sql`, `)})
        )`
      );
    }

    // hasVideoフィルタ（EXISTS サブクエリ）
    if (options?.hasVideo) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productPerformers} pp
          JOIN ${productVideos} pv ON pp.product_id = pv.product_id
          WHERE pp.performer_id = ${performers['id']}
        )`
      );
    }

    // hasImageフィルタ（EXISTS サブクエリ）
    if (options?.hasImage) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productPerformers} pp
          JOIN ${productImages} pi ON pp.product_id = pi.product_id
          WHERE pp.performer_id = ${performers['id']}
        )`
      );
    }

    // hasReviewフィルタ
    if (options?.hasReview) {
      conditions.push(sql`${performers.aiReview} IS NOT NULL`);
    }

    // 女優特徴フィルター（enableActressFeatureFilterがtrueの場合のみ）
    if (enableActressFeatureFilter) {
      if (options?.cupSizes && options.cupSizes.length > 0) {
        conditions.push(
          sql`${performers['cup']} IN (${sql.join(options.cupSizes.map(c => sql`${c}`), sql`, `)})`
        );
      }
      if (options?.heightMin !== undefined) {
        conditions.push(sql`${performers['height']} >= ${options.heightMin}`);
      }
      if (options?.heightMax !== undefined) {
        conditions.push(sql`${performers['height']} <= ${options.heightMax}`);
      }
      if (options?.bloodTypes && options.bloodTypes.length > 0) {
        conditions.push(
          sql`${performers['bloodType']} IN (${sql.join(options.bloodTypes.map(b => sql`${b}`), sql`, `)})`
        );
      }

      // デビュー年フィルター
      if (options?.debutYearRange) {
        const range = options.debutYearRange;
        if (range.startsWith('-')) {
          // '-2009' → 2009年以前
          const endYear = parseInt(range.slice(1), 10);
          if (!isNaN(endYear)) {
            conditions.push(sql`${performers['debutYear']} <= ${endYear}`);
            conditions.push(sql`${performers['debutYear']} IS NOT NULL`);
          }
        } else if (range.endsWith('-')) {
          // '2024-' → 2024年以降
          const startYear = parseInt(range.slice(0, -1), 10);
          if (!isNaN(startYear)) {
            conditions.push(sql`${performers['debutYear']} >= ${startYear}`);
          }
        } else if (range.includes('-')) {
          // '2020-2023' → 範囲指定
          const [startStr, endStr] = range.split('-');
          const startYear = parseInt(startStr, 10);
          const endYear = parseInt(endStr, 10);
          if (!isNaN(startYear) && !isNaN(endYear)) {
            conditions.push(sql`${performers['debutYear']} >= ${startYear}`);
            conditions.push(sql`${performers['debutYear']} <= ${endYear}`);
          }
        }
      }

      // 最低作品数フィルター
      if (options?.minWorks !== undefined && options.minWorks > 0) {
        conditions.push(sql`${performers['releaseCount']} >= ${options.minWorks}`);
      }
    }

    // セール中フィルター
    if (options?.onSale) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${productPerformers} pp_sale
        INNER JOIN product_sales ps_sale ON pp_sale.product_id = ps_sale.product_id
        WHERE pp_sale.performer_id = ${performers['id']}
          AND ps_sale.start_at <= NOW()
          AND ps_sale.end_at >= NOW()
      )`);
    }

    // 検索クエリ（別名マッチングもEXISTS サブクエリに変換）
    if (options?.query) {
      const isInitialSearch = options.query.length === 1;
      const searchPattern = isInitialSearch ? options.query + '%' : '%' + options.query + '%';

      const isGetActresses = 'limit' in (options || {});
      const nameConditions = isInitialSearch
        ? sql`${performers['nameKana']} IS NOT NULL AND ${performers['nameKana']} ILIKE ${searchPattern}`
        : isGetActresses
          ? or(
              sql`similarity(${performers['name']}, ${options.query}) > 0.2`,
              sql`similarity(${performers['nameKana']}, ${options.query}) > 0.2`,
              sql`${performers['name']} ILIKE ${searchPattern}`,
              sql`${performers['nameKana']} ILIKE ${searchPattern}`,
              sql`${performers.aiReview} ILIKE ${searchPattern}`
            )!
          : or(
              sql`similarity(${performers['name']}, ${options.query}) > 0.2`,
              sql`similarity(${performers['nameKana']}, ${options.query}) > 0.2`,
              sql`${performers['name']} ILIKE ${searchPattern}`,
              sql`${performers['nameKana']} ILIKE ${searchPattern}`
            )!;

      // 別名マッチングをEXISTSサブクエリに変換
      const aliasExistsCondition = sql`EXISTS (
        SELECT 1 FROM ${performerAliases} pa
        WHERE pa.performer_id = ${performers['id']}
        AND (
          similarity(pa.alias_name, ${options.query}) > 0.2
          OR pa.alias_name ILIKE ${searchPattern}
        )
      )`;

      conditions.push(or(nameConditions, aliasExistsCondition)!);
    }

    return { conditions };
  }

  /**
   * 女優一覧を取得
   */
  async function getActresses<T>(options?: GetActressesOptions): Promise<T[]> {
    try {
      const db = getDb();
      const { conditions } = buildConditions(options);

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
            desc(performers['id'])
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
            desc(performers['id'])
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);
      } else {
        // 名前順
        let orderByClauses;
        switch (sortBy) {
          case 'nameAsc':
            orderByClauses = [asc(sql`COALESCE(${performers['nameKana']}, '龠')`), asc(performers['id'])];
            break;
          case 'nameDesc':
            orderByClauses = [desc(sql`COALESCE(${performers['nameKana']}, '')`), desc(performers['id'])];
            break;
          default:
            orderByClauses = [asc(sql`COALESCE(${performers['nameKana']}, '龠')`), asc(performers['id'])];
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
      const performerIds = extractIds(results);
      const [thumbnails, servicesMap, aliasesMap] = await Promise.all([
        batchGetPerformerThumbnails(performerIds),
        batchGetPerformerServices(performerIds),
        batchGetPerformerAliases(performerIds),
      ]);

      const locale = options?.locale || 'ja';
      // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
      const actresses = results.map((performer: Record<string, unknown>) => {
        const id = performer['id'] as number;
        const releaseCount = (performer['releaseCount'] as number | null) ?? 0;
        return mapPerformerToActress(
          performer,
          releaseCount,
          thumbnails.get(id),
          servicesMap.get(id),
          aliasesMap.get(id),
          locale
        );
      });

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
      options?.hasVideo || options?.hasImage || options?.hasReview || options?.onSale ||
      (enableActressFeatureFilter && (options?.cupSizes?.length || options?.heightMin || options?.heightMax || options?.bloodTypes?.length || options?.debutYearRange || options?.minWorks));

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
      const { conditions } = buildConditions(options);

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
      logDbErrorAndThrow(error, 'getActressesCount');
    }
  }

  return {
    getActresses,
    getActressesCount,
  };
}
