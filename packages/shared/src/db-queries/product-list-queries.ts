/**
 * 商品リストクエリ
 * getProducts/getProductsCount共通化
 */
import { eq, and, or, desc, asc, sql, inArray, SQL, lt, gt } from 'drizzle-orm';
import type { GetProductsOptions, ProductSortOption, CursorPaginatedResult, CursorData } from './types';
import type { SiteMode } from './asp-filter';
import { decodeCursor, encodeCursor, createCursorFromProduct } from '../lib/cursor-pagination';
import { createAspFilterCondition, createProviderFilterCondition, createMultiProviderFilterCondition, createExcludeProviderFilterCondition } from './asp-filter';
import { generateProductIdVariations } from '../lib/product-id-utils';
import { normalizeTitle, deduplicateProductsByTitle, type DeduplicatableProduct } from '../lib/deduplication';
import type { BatchRelatedDataResult } from './core-queries';
import type { MapProductsWithBatchDataDeps, DbProduct } from './mappers';
import { mapProductsWithBatchData } from './mappers';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Drizzle ORM型定義（DIパターン用）
type DrizzleDb = NodePgDatabase;
type AnyTable = PgTableWithColumns<TableConfig>;

// ============================================================
// Types
// ============================================================

export interface ProductListQueryDeps {
  /** データベース取得関数 */
  getDb: () => DrizzleDb;
  /** productsテーブル */
  products: AnyTable;
  /** productSourcesテーブル */
  productSources: AnyTable;
  /** productPerformersテーブル */
  productPerformers: AnyTable;
  /** productTagsテーブル */
  productTags: AnyTable;
  /** productImagesテーブル */
  productImages: AnyTable;
  /** productVideosテーブル */
  productVideos: AnyTable;
  /** productSalesテーブル */
  productSales: AnyTable;
  /** productRatingSummaryテーブル */
  productRatingSummary: AnyTable;
  /** サイトモード */
  siteMode: SiteMode;
  /** バッチ関連データ取得関数 */
  batchFetchProductRelatedData: (productIds: number[], providerFilters?: string[]) => Promise<BatchRelatedDataResult>;
  /** 商品マッパー依存性 */
  mapperDeps: MapProductsWithBatchDataDeps;
  /** 単一商品関連データ取得関数 (getProductsByCategory用) */
  fetchProductRelatedData?: (productId: number) => Promise<{
    performerData: unknown[];
    tagData: unknown[];
    sourceData: unknown;
    imagesData: unknown[];
    videosData: unknown[];
  }>;
  /** 商品マッパー関数 (getProductsByCategory用) */
  mapProductToType?: (
    product: unknown,
    performers: unknown[],
    tags: unknown[],
    source: unknown,
    cache: unknown,
    images: unknown[],
    videos: unknown[],
    locale: string
  ) => unknown;
}

/**
 * getProductsByCategory用オプション
 */
export interface GetProductsByCategoryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'releaseDateDesc' | 'releaseDateAsc';
  initial?: string;
  includeAsp?: string[];
  excludeAsp?: string[];
  hasVideo?: boolean;
  hasImage?: boolean;
  performerType?: 'solo' | 'multi';
  locale?: string;
}

export interface ProductListQueries {
  getProducts: <T extends DeduplicatableProduct>(options?: GetProductsOptions) => Promise<T[]>;
  getProductsCount: (options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>) => Promise<number>;
  getProductsByCategory: <T>(tagId: number, options?: GetProductsByCategoryOptions) => Promise<T[]>;
  getProductsWithCursor: <T extends DeduplicatableProduct>(options?: Omit<GetProductsOptions, 'offset'> & { cursor?: string }) => Promise<CursorPaginatedResult<T>>;
}

// ============================================================
// Factory
// ============================================================

/**
 * 商品リストクエリファクトリー
 */
export function createProductListQueries(deps: ProductListQueryDeps): ProductListQueries {
  const {
    getDb,
    products,
    productSources,
    productPerformers,
    productTags,
    productImages,
    productVideos,
    productSales,
    productRatingSummary,
    siteMode,
    batchFetchProductRelatedData,
    mapperDeps,
  } = deps;

  /**
   * 共通条件を構築
   */
  function buildConditions(options?: GetProductsOptions): SQL[] {
    const conditions: SQL[] = [];

    // ASPフィルタ（サイトモードに応じて）
    conditions.push(createAspFilterCondition(products, productSources, siteMode));

    // 特定のIDリストでフィルタ（バッチ取得用）
    if (options?.ids && options.ids.length > 0) {
      conditions.push(inArray(products.id, options.ids));
    }

    // プロバイダー（ASP）でフィルタ（単一）
    if (options?.provider) {
      conditions.push(createProviderFilterCondition(products, productSources, options.provider));
    }

    // 複数プロバイダー（ASP）でフィルタ（いずれかを含む）
    if (options?.providers && options.providers.length > 0) {
      conditions.push(createMultiProviderFilterCondition(products, productSources, options.providers));
    }

    // 除外プロバイダー（ASP）でフィルタ（いずれも含まない）
    if (options?.excludeProviders && options.excludeProviders.length > 0) {
      conditions.push(createExcludeProviderFilterCondition(products, productSources, options.excludeProviders));
    }

    // 価格フィルタ（productSourcesの価格を使用）
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      const priceConditions: SQL[] = [];
      if (options.minPrice !== undefined) {
        priceConditions.push(sql`ps.price >= ${options.minPrice}`);
      }
      if (options.maxPrice !== undefined) {
        priceConditions.push(sql`ps.price <= ${options.maxPrice}`);
      }

      // EXISTSを使用
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ${sql.join(priceConditions, sql` AND `)}
        )`
      );
    }

    // 女優IDでフィルタ（多対多リレーション）
    if (options?.actressId) {
      const performerId = parseInt(options.actressId);
      if (!isNaN(performerId)) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productPerformers} pp
            WHERE pp.product_id = ${products.id}
            AND pp.performer_id = ${performerId}
          )`
        );
      }
    }

    // タグでフィルタ（対象タグ - いずれかを含む）
    if (options?.tags && options.tags.length > 0) {
      const tagIds = options.tags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${productTags} pt
            WHERE pt.product_id = ${products.id}
            AND pt.tag_id IN (${sql.join(tagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      const excludeTagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
      if (excludeTagIds.length > 0) {
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${productTags} pt
            WHERE pt.product_id = ${products.id}
            AND pt.tag_id IN (${sql.join(excludeTagIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }
    }

    // 検索クエリ（品番検索 + PostgreSQL Full Text Search）
    if (options?.query) {
      const query = options.query.trim();
      const searchPattern = `%${query}%`;

      // 品番パターンの判定（英数字とハイフン/アンダースコアの組み合わせ）
      const isProductIdPattern = /^[a-zA-Z0-9]+[-_]?[a-zA-Z0-9]+$/.test(query) && query.length >= 4;

      if (isProductIdPattern) {
        // 品番検索: バリエーションを生成してnormalizedProductIdとoriginalProductIdで検索
        const variants = generateProductIdVariations(query);
        const variantPatterns = variants.map(v => `%${v}%`);

        conditions.push(
          sql`(
            ${products.normalizedProductId} = ANY(${variants})
            OR ${products.normalizedProductId} ILIKE ANY(${variantPatterns})
            OR ${products.makerProductCode} ILIKE ANY(${variantPatterns})
            OR EXISTS (
              SELECT 1 FROM ${productSources} ps
              WHERE ps.product_id = ${products.id}
              AND (ps.original_product_id = ANY(${variants}) OR ps.original_product_id ILIKE ANY(${variantPatterns}))
            )
            OR ${products}.search_vector @@ plainto_tsquery('simple', ${query})
            OR ${products.title} ILIKE ${searchPattern}
          )`
        );
      } else {
        // 通常の全文検索（タイトル、説明文、AI説明文）
        conditions.push(
          sql`(
            ${products}.search_vector @@ plainto_tsquery('simple', ${query})
            OR ${products.title} ILIKE ${searchPattern}
            OR ${products.aiDescription}::text ILIKE ${searchPattern}
          )`
        );
      }
    }

    // サンプル動画ありフィルタ
    if (options?.hasVideo) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productVideos} pv
          WHERE pv.product_id = ${products.id}
        )`
      );
    }

    // サンプル画像ありフィルタ
    if (options?.hasImage) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productImages} pi
          WHERE pi.product_id = ${products.id}
        )`
      );
    }

    // 出演形態フィルタ
    if (options?.performerType === 'solo') {
      // 単体出演: 出演者が1人のみ
      conditions.push(
        sql`(
          SELECT COUNT(*) FROM ${productPerformers} pp
          WHERE pp.product_id = ${products.id}
        ) = 1`
      );
    } else if (options?.performerType === 'multi') {
      // 複数出演: 出演者が2人以上
      conditions.push(
        sql`(
          SELECT COUNT(*) FROM ${productPerformers} pp
          WHERE pp.product_id = ${products.id}
        ) >= 2`
      );
    }

    // セール中フィルタ
    if (options?.onSale) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${productSources} ps
          INNER JOIN ${productSales} psl ON psl.product_source_id = ps.id
          WHERE ps.product_id = ${products.id}
          AND psl.is_active = true
          AND (psl.end_at IS NULL OR psl.end_at > NOW())
        )`
      );
    }

    // 未整理作品フィルタ（出演者なし）
    if (options?.uncategorized) {
      conditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productPerformers} pp
          WHERE pp.product_id = ${products.id}
        )`
      );
    }

    return conditions;
  }

  /**
   * ソート句を構築
   */
  function buildOrderByClause(sortBy?: ProductSortOption): SQL[] {
    switch (sortBy) {
      case 'releaseDateAsc':
        return [sql`${products.releaseDate} ASC NULLS LAST`, asc(products.normalizedProductId)];
      case 'titleAsc':
        return [asc(products.title), asc(products.normalizedProductId)];
      case 'durationDesc':
        return [desc(sql`COALESCE(${products.duration}, 0)`), sql`${products.releaseDate} DESC NULLS LAST`, desc(products.normalizedProductId)];
      case 'durationAsc':
        return [asc(sql`COALESCE(${products.duration}, 0)`), sql`${products.releaseDate} DESC NULLS LAST`, asc(products.normalizedProductId)];
      case 'random':
        return [sql`RANDOM()`];
      case 'releaseDateDesc':
      default:
        return [sql`${products.releaseDate} DESC NULLS LAST`, desc(products.normalizedProductId)];
    }
  }

  /**
   * 価格ソート時の重複排除（サイトモードに応じた処理）
   */
  function deduplicateForPriceSort<T extends DeduplicatableProduct>(mappedProducts: T[]): T[] {
    if (siteMode === 'fanza-only') {
      // FANZAサイト: 単純に最安を選択
      const productsByTitle = new Map<string, T>();
      for (const product of mappedProducts) {
        const normalizedTitleKey = normalizeTitle(product.title);
        const existing = productsByTitle.get(normalizedTitleKey);
        if (!existing) {
          productsByTitle.set(normalizedTitleKey, product);
        } else {
          const existingPrice = existing.salePrice || existing.price || Infinity;
          const currentPrice = product.salePrice || product.price || Infinity;
          if (currentPrice < existingPrice) {
            productsByTitle.set(normalizedTitleKey, product);
          }
        }
      }

      const seenTitles = new Set<string>();
      return mappedProducts.filter(product => {
        const normalizedTitleKey = normalizeTitle(product.title);
        if (seenTitles.has(normalizedTitleKey)) return false;
        seenTitles.add(normalizedTitleKey);
        const cheapest = productsByTitle.get(normalizedTitleKey);
        return cheapest?.id === product.id;
      });
    } else {
      // Webサイト: alternativeSourcesを保持
      const productGroupsByTitle = new Map<string, T[]>();
      for (const product of mappedProducts) {
        const normalizedTitleKey = normalizeTitle(product.title);
        const group = productGroupsByTitle.get(normalizedTitleKey) || [];
        group.push(product);
        productGroupsByTitle.set(normalizedTitleKey, group);
      }

      const deduplicatedProducts: T[] = [];
      for (const [, group] of productGroupsByTitle) {
        const sortedGroup = [...group].sort((a, b) => {
          const priceA = a.salePrice || a.price || Infinity;
          const priceB = b.salePrice || b.price || Infinity;
          return priceA - priceB;
        });
        const cheapest = sortedGroup[0];
        if (sortedGroup.length > 1) {
          cheapest.alternativeSources = sortedGroup.slice(1).map(p => ({
            aspName: p.provider || 'unknown',
            price: p.price,
            salePrice: p.salePrice,
            affiliateUrl: p.affiliateUrl || '',
            productId: typeof p.id === 'string' ? parseInt(p.id, 10) : (p.id as number),
          }));
        }
        deduplicatedProducts.push(cheapest);
      }

      const originalOrder = new Map(mappedProducts.map((p, i) => [p.id, i]));
      deduplicatedProducts.sort((a, b) => (originalOrder.get(a.id as string) ?? Infinity) - (originalOrder.get(b.id as string) ?? Infinity));
      return deduplicatedProducts;
    }
  }

  /**
   * 商品リストを取得
   */
  async function getProducts<T extends DeduplicatableProduct>(options?: GetProductsOptions): Promise<T[]> {
    try {
      const db = getDb();
      const conditions = buildConditions(options);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 価格ソートの場合は特別な処理が必要（productSourcesとJOIN）
      if (options?.sortBy === 'priceAsc' || options?.sortBy === 'priceDesc') {
        const results = await db
          .selectDistinct({
            product: products,
            price: productSources.price,
          })
          .from(products)
          .innerJoin(productSources, eq(products.id, productSources.productId))
          .where(whereClause)
          .orderBy(
            options.sortBy === 'priceAsc'
              ? asc(productSources.price)
              : desc(productSources.price)
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチでデータを取得
        // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
        const productList = results.map((r) => r.product as unknown as DbProduct);
        const productIds = productList.map((p) => p.id);
        if (productIds.length === 0) return [];

        // サイトモードに応じてプロバイダーフィルターを渡す
        const batchData = siteMode === 'all'
          ? await batchFetchProductRelatedData(productIds, options?.providers)
          : await batchFetchProductRelatedData(productIds);
        const mappedProducts = mapProductsWithBatchData(productList, batchData, mapperDeps, options?.locale || 'ja') as T[];

        // タイトルベースの重複排除（サイトモードに応じた処理）
        return deduplicateForPriceSort(mappedProducts);
      }

      // 評価/レビュー数ソートの場合は特別な処理が必要（productRatingSummaryとJOIN）
      if (options?.sortBy === 'ratingDesc' || options?.sortBy === 'ratingAsc' || options?.sortBy === 'reviewCountDesc') {
        const results = await db
          .select({
            product: products,
            avgRating: productRatingSummary.averageRating,
            totalReviews: productRatingSummary.totalReviews,
          })
          .from(products)
          .leftJoin(productRatingSummary, eq(products.id, productRatingSummary.productId))
          .where(whereClause)
          .orderBy(
            options.sortBy === 'ratingDesc'
              ? desc(sql`COALESCE(${productRatingSummary.averageRating}, 0)`)
              : options.sortBy === 'ratingAsc'
              ? asc(sql`COALESCE(${productRatingSummary.averageRating}, 0)`)
              : desc(sql`COALESCE(${productRatingSummary.totalReviews}, 0)`),
            desc(products.releaseDate)
          )
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチでデータを取得
        // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
        const productList = results.map((r) => r.product as unknown as DbProduct);
        const productIds = productList.map((p) => p.id);
        if (productIds.length === 0) return [];

        // サイトモードに応じてプロバイダーフィルターを渡す
        const batchData = siteMode === 'all'
          ? await batchFetchProductRelatedData(productIds, options?.providers)
          : await batchFetchProductRelatedData(productIds);
        const mappedProducts = mapProductsWithBatchData(productList, batchData, mapperDeps, options?.locale || 'ja') as T[];

        // タイトルベースの重複排除（共通関数使用）
        return deduplicateProductsByTitle(mappedProducts, siteMode) as T[];
      }

      // 通常のソート処理
      const orderByClause = buildOrderByClause(options?.sortBy);

      const results = await db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(...orderByClause)
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      // バッチでデータを取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedResults = results as any[];
      const productIds = typedResults.map((p) => p.id as number);
      if (productIds.length === 0) return [];

      // サイトモードに応じてプロバイダーフィルターを渡す
      const batchData = siteMode === 'all'
        ? await batchFetchProductRelatedData(productIds, options?.providers)
        : await batchFetchProductRelatedData(productIds);
      const dbProducts = typedResults.map((p) => ({
        id: p.id as number,
        title: p.title as string,
        normalizedProductId: p.normalizedProductId as string | null,
        defaultThumbnailUrl: p.defaultThumbnailUrl as string | null,
        releaseDate: p.releaseDate as Date | null,
        duration: p.duration as number | null,
        makerName: p.makerName as string | null,
        labelName: p.labelName as string | null,
        description: p.description as string | null,
        reviewCount: p.reviewCount as number | null,
        reviewAverage: p.reviewAverage as number | null,
        createdAt: p.createdAt as Date | null,
        updatedAt: p.updatedAt as Date | null,
      })) as DbProduct[];
      const mappedProducts = mapProductsWithBatchData(dbProducts, batchData, mapperDeps, options?.locale || 'ja') as T[];

      // タイトルベースの重複排除（共通関数使用）
      return deduplicateProductsByTitle(mappedProducts, siteMode) as T[];
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  /**
   * フィルターオプションが空かどうかを判定
   */
  function hasNoFilters(options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>): boolean {
    if (!options) return true;
    return !options.query &&
           !options.providers?.length &&
           !options.excludeProviders?.length &&
           !options.tags?.length &&
           !options.excludeTags?.length &&
           !options.hasVideo &&
           !options.hasImage &&
           !options.onSale &&
           !options.uncategorized &&
           !options.performerType &&
           !options.actressId &&
           !options.isNew &&
           !options.isFeatured;
  }

  /**
   * 商品数を取得
   * パフォーマンス最適化:
   * - フィルターなし: 単純COUNT（高速）
   * - フィルターあり: 条件付きCOUNT（重複排除なし）
   *
   * 注: 重複排除はgetProducts側で行うため、カウントは概算値となる
   */
  async function getProductsCount(options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>): Promise<number> {
    try {
      const db = getDb();

      // フィルターなしの場合は単純カウント（最速）
      if (hasNoFilters(options)) {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(products);
        return Number(result[0]?.count || 0);
      }

      // フィルターありの場合
      const conditions = buildConditions(options as GetProductsOptions);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // プロバイダーフィルターがある場合はproduct_sourcesとJOIN
      if (options?.providers?.length || options?.excludeProviders?.length) {
        const result = await db
          .select({ count: sql<number>`count(DISTINCT ${products.id})` })
          .from(products)
          .innerJoin(productSources, eq(products.id, productSources.productId))
          .where(whereClause);
        return Number(result[0]?.count || 0);
      }

      // その他のフィルター: 単純カウント
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(whereClause);

      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error('Error counting products:', error);
      return 0;
    }
  }

  /**
   * 特定カテゴリの商品一覧を取得
   */
  async function getProductsByCategory<T>(
    tagId: number,
    options?: GetProductsByCategoryOptions
  ): Promise<T[]> {
    // fetchProductRelatedData と mapProductToType が必須
    if (!deps.fetchProductRelatedData || !deps.mapProductToType) {
      console.error('getProductsByCategory requires fetchProductRelatedData and mapProductToType in deps');
      return [];
    }

    try {
      const db = getDb();
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const initial = options?.initial || '';
      const includeAsp = options?.includeAsp || [];
      const locale = options?.locale || 'ja';
      const excludeAsp = options?.excludeAsp || [];
      const hasVideo = options?.hasVideo || false;
      const hasImage = options?.hasImage || false;
      const performerType = options?.performerType;

      // 頭文字フィルター条件
      let initialCondition = sql`TRUE`;
      if (initial) {
        if (initial === 'etc') {
          initialCondition = sql`p.title !~ '^[あ-んア-ンa-zA-Z]'`;
        } else if (/^[A-Za-z]$/.test(initial)) {
          initialCondition = sql`UPPER(LEFT(p.title, 1)) = ${initial.toUpperCase()}`;
        } else {
          initialCondition = sql`LEFT(p.title, 1) = ${initial}`;
        }
      }

      // ASPフィルター条件（対象/除外）
      let aspCondition = sql`TRUE`;
      if (includeAsp.length > 0) {
        aspCondition = sql`ps.asp_name IN (${sql.join(includeAsp.map(a => sql`${a}`), sql`, `)})`;
      }
      let excludeAspCondition = sql`TRUE`;
      if (excludeAsp.length > 0) {
        excludeAspCondition = sql`(ps.asp_name IS NULL OR ps.asp_name NOT IN (${sql.join(excludeAsp.map(a => sql`${a}`), sql`, `)}))`;
      }

      // サンプルコンテンツフィルター条件
      let videoCondition = sql`TRUE`;
      if (hasVideo) {
        videoCondition = sql`EXISTS (SELECT 1 FROM product_videos pv WHERE pv.product_id = p.id)`;
      }
      let imageCondition = sql`TRUE`;
      if (hasImage) {
        imageCondition = sql`EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)`;
      }

      // 出演形態フィルター条件
      let performerTypeCondition = sql`TRUE`;
      if (performerType === 'solo') {
        performerTypeCondition = sql`(SELECT COUNT(*) FROM product_performers pp WHERE pp.product_id = p.id) = 1`;
      } else if (performerType === 'multi') {
        performerTypeCondition = sql`(SELECT COUNT(*) FROM product_performers pp WHERE pp.product_id = p.id) >= 2`;
      }

      // SQLでフィルター付きクエリを実行
      const query = sql`
        SELECT DISTINCT p.*
        FROM products p
        INNER JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN product_sources ps ON p.id = ps.product_id
        WHERE pt.tag_id = ${tagId}
        AND ${initialCondition}
        AND ${aspCondition}
        AND ${excludeAspCondition}
        AND ${videoCondition}
        AND ${imageCondition}
        AND ${performerTypeCondition}
        ORDER BY p.release_date DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const results = await db.execute(query);

      // フル情報を取得
      const rows = results.rows as unknown as Array<{
        id: number;
        normalized_product_id?: string;
        maker_product_code?: string;
        title?: string;
        release_date?: Date | string;
        description?: string;
        duration?: number;
        default_thumbnail_url?: string;
        title_en?: string;
        title_zh?: string;
        title_zh_tw?: string;
        title_ko?: string;
        description_en?: string;
        description_zh?: string;
        description_zh_tw?: string;
        description_ko?: string;
        ai_description?: string;
        ai_catchphrase?: string;
        ai_short_description?: string;
        ai_tags?: string;
        ai_review?: string;
        ai_review_updated_at?: Date;
        created_at?: Date;
        updated_at?: Date;
      }>;
      const productIds = rows.map(r => r.id);
      if (productIds.length === 0) return [];

      const fullProducts = await Promise.all(
        productIds.map(async (productId) => {
          const { performerData, tagData, sourceData, imagesData, videosData } = await deps.fetchProductRelatedData!(productId);
          const baseProduct = rows.find(r => r.id === productId)!;

          // 日付処理: Date型の場合はISO文字列に変換
          const releaseDate = baseProduct.release_date instanceof Date
            ? baseProduct.release_date.toISOString().split('T')[0]
            : baseProduct.release_date ?? null;

          return deps.mapProductToType!(
            {
              id: baseProduct.id,
              normalizedProductId: baseProduct.normalized_product_id || '',
              makerProductCode: baseProduct.maker_product_code ?? null,
              title: baseProduct.title || '',
              releaseDate,
              description: baseProduct.description ?? null,
              duration: baseProduct.duration ?? null,
              defaultThumbnailUrl: baseProduct.default_thumbnail_url ?? null,
              titleEn: baseProduct.title_en ?? null,
              titleZh: baseProduct.title_zh ?? null,
              titleZhTw: baseProduct.title_zh_tw ?? null,
              titleKo: baseProduct.title_ko ?? null,
              descriptionEn: baseProduct.description_en ?? null,
              descriptionZh: baseProduct.description_zh ?? null,
              descriptionZhTw: baseProduct.description_zh_tw ?? null,
              descriptionKo: baseProduct.description_ko ?? null,
              aiDescription: baseProduct.ai_description ?? null,
              aiCatchphrase: baseProduct.ai_catchphrase ?? null,
              aiShortDescription: baseProduct.ai_short_description ?? null,
              aiTags: baseProduct.ai_tags ?? null,
              aiReview: baseProduct.ai_review ?? null,
              aiReviewUpdatedAt: baseProduct.ai_review_updated_at ?? null,
              createdAt: baseProduct.created_at ?? new Date(),
              updatedAt: baseProduct.updated_at ?? new Date(),
            },
            performerData,
            tagData,
            sourceData,
            undefined,
            imagesData,
            videosData,
            locale
          );
        })
      );

      return fullProducts as T[];
    } catch (error) {
      console.error('Error getting products by category:', error);
      return [];
    }
  }

  /**
   * カーソルベースページネーションで商品を取得
   *
   * オフセットベースより高パフォーマンス:
   * - 大規模データセットでも一定のパフォーマンス
   * - リアルタイム更新時の重複/欠落防止
   *
   * 制限事項:
   * - releaseDateDesc/releaseDateAscソートのみ対応
   * - ランダムソート非対応
   */
  async function getProductsWithCursor<T extends DeduplicatableProduct>(
    options?: Omit<GetProductsOptions, 'offset'> & { cursor?: string }
  ): Promise<CursorPaginatedResult<T>> {
    try {
      const db = getDb();
      const limit = options?.limit || 100;
      const sortBy = options?.sortBy || 'releaseDateDesc';

      // カーソルベースは releaseDate ソートのみ対応
      if (sortBy !== 'releaseDateDesc' && sortBy !== 'releaseDateAsc') {
        throw new Error(`Cursor pagination only supports releaseDateDesc/releaseDateAsc. Got: ${sortBy}`);
      }

      const isDescending = sortBy === 'releaseDateDesc';

      // カーソルをデコード
      let cursorData: CursorData | null = null;
      if (options?.cursor) {
        cursorData = decodeCursor(options.cursor);
        if (!cursorData) {
          throw new Error('Invalid cursor');
        }
      }

      // 基本条件を構築
      const baseConditions = buildConditions(options as GetProductsOptions);

      // カーソル条件を追加
      if (cursorData) {
        const { releaseDate, id } = cursorData;

        if (releaseDate === null) {
          // NULLの中でidで比較
          if (isDescending) {
            baseConditions.push(
              or(
                sql`${products.releaseDate} IS NOT NULL`,
                and(
                  sql`${products.releaseDate} IS NULL`,
                  lt(products.id, id)
                )
              )!
            );
          } else {
            baseConditions.push(
              and(
                sql`${products.releaseDate} IS NULL`,
                gt(products.id, id)
              )!
            );
          }
        } else {
          // 通常のカーソル条件
          const cursorDate = new Date(releaseDate);
          if (isDescending) {
            baseConditions.push(
              or(
                lt(products.releaseDate, cursorDate),
                and(
                  eq(products.releaseDate, cursorDate),
                  lt(products.id, id)
                ),
                sql`${products.releaseDate} IS NULL`
              )!
            );
          } else {
            baseConditions.push(
              or(
                gt(products.releaseDate, cursorDate),
                and(
                  eq(products.releaseDate, cursorDate),
                  gt(products.id, id)
                )
              )!
            );
          }
        }
      }

      const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;

      // +1件取得して次ページの有無を判定
      const results = await db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(
          isDescending
            ? desc(sql`COALESCE(${products.releaseDate}, '1970-01-01')`)
            : asc(sql`COALESCE(${products.releaseDate}, '9999-12-31')`),
          isDescending ? desc(products.id) : asc(products.id)
        )
        .limit(limit + 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedResults = results as any[];
      const hasMore = typedResults.length > limit;
      const itemsToProcess = hasMore ? typedResults.slice(0, limit) : typedResults;

      const productIds = itemsToProcess.map((p) => p.id as number);
      if (productIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }

      // バッチでデータを取得
      const batchData = siteMode === 'all'
        ? await batchFetchProductRelatedData(productIds, options?.providers)
        : await batchFetchProductRelatedData(productIds);

      const dbProducts = itemsToProcess.map((p) => ({
        id: p.id as number,
        title: p.title as string,
        normalizedProductId: p.normalizedProductId as string | null,
        defaultThumbnailUrl: p.defaultThumbnailUrl as string | null,
        releaseDate: p.releaseDate as Date | null,
        duration: p.duration as number | null,
        makerName: p.makerName as string | null,
        labelName: p.labelName as string | null,
        description: p.description as string | null,
        reviewCount: p.reviewCount as number | null,
        reviewAverage: p.reviewAverage as number | null,
        createdAt: p.createdAt as Date | null,
        updatedAt: p.updatedAt as Date | null,
      })) as DbProduct[];

      const mappedProducts = mapProductsWithBatchData(dbProducts, batchData, mapperDeps, options?.locale || 'ja') as T[];
      const deduplicatedProducts = deduplicateProductsByTitle(mappedProducts, siteMode) as T[];

      // 次のカーソルを生成
      let nextCursor: string | null = null;
      if (hasMore && deduplicatedProducts.length > 0) {
        const lastProduct = deduplicatedProducts[deduplicatedProducts.length - 1];
        // 元のDBデータからreleaseDateを取得（マッピング後のデータはフォーマットが変わっている可能性）
        const lastDbProduct = dbProducts.find((p) => p.id === (lastProduct as { id: number }).id);
        if (lastDbProduct) {
          nextCursor = encodeCursor(createCursorFromProduct(lastDbProduct));
        }
      }

      return {
        items: deduplicatedProducts,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      console.error('Error fetching products with cursor:', error);
      throw error;
    }
  }

  return {
    getProducts,
    getProductsCount,
    getProductsByCategory,
    getProductsWithCursor,
  };
}

export type { GetProductsOptions, ProductSortOption, CursorPaginatedResult };
