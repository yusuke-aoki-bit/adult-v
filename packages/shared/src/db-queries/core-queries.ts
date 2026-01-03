/**
 * コア商品/女優クエリ
 * apps/web と apps/fanza で共通利用される主要クエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, sql, inArray, desc, asc, SQL, or, ilike } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// DI用の型エイリアス（anyを回避しつつ柔軟性を保つ）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = NodePgDatabase<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = PgTableWithColumns<any>;

/**
 * LIKE/ILIKE用のワイルドカード文字をエスケープ
 * SQLインジェクション防止のためユーザー入力をサニタイズ
 */
function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // バックスラッシュをエスケープ
    .replace(/%/g, '\\%')    // %をエスケープ
    .replace(/_/g, '\\_');   // _をエスケープ
}
import type { SourceData as MapperSourceData } from './mappers';
import { selectProductSources, groupSourcesByProduct } from '../lib/source-selection';
import { buildAspNormalizationSql } from '../lib/asp-utils';
import {
  extractIds,
  extractProductIds,
  toPerformerRows,
  toTagRows,
  toSourceRow,
  toImageRows,
  toVideoRows,
} from '../lib/type-guards';

// ============================================================
// Types
// ============================================================

export interface CoreQueryDeps {
  /** データベース取得関数 */
  getDb: () => DrizzleDb;
  /** productsテーブル */
  products: AnyTable;
  /** performersテーブル */
  performers: AnyTable;
  /** productPerformersテーブル */
  productPerformers: AnyTable;
  /** performerAliasesテーブル */
  performerAliases: AnyTable;
  /** tagsテーブル */
  tags: AnyTable;
  /** productTagsテーブル */
  productTags: AnyTable;
  /** productSourcesテーブル */
  productSources: AnyTable;
  /** productImagesテーブル */
  productImages: AnyTable;
  /** productVideosテーブル */
  productVideos: AnyTable;
  /** productSalesテーブル */
  productSales: AnyTable;
  /** サイトモード ('all' | 'fanza-only') */
  siteMode: 'all' | 'fanza-only';
  /** 演者バリデーション関数 */
  isValidPerformer?: (performer: { name: string }) => boolean;
}

/**
 * 商品関連データの結果型
 */
export interface ProductRelatedData {
  performerData: Array<{ id: number; name: string; nameKana: string | null }>;
  tagData: Array<{ id: number; name: string; category: string | null }>;
  sourceData: MapperSourceData | undefined;
  imagesData: Array<{
    productId: number;
    imageUrl: string;
    imageType: string;
    displayOrder: number | null;
  }>;
  videosData: Array<{
    productId: number;
    videoUrl: string;
    videoType: string | null;
    quality: string | null;
    duration: number | null;
  }>;
  saleData?: {
    regularPrice: number;
    salePrice: number;
    discountPercent: number | null;
    endAt: Date | null;
  };
}

/**
 * バッチ取得用の出演者データ
 */
export interface BatchPerformerData {
  id: number;
  name: string;
  nameKana: string | null;
}

/**
 * バッチ取得用のタグデータ
 */
export interface BatchTagData {
  id: number;
  name: string;
  category: string | null;
}

/**
 * バッチ取得用の画像データ
 */
export interface BatchImageData {
  productId: number;
  imageUrl: string;
  imageType: string;
  displayOrder: number | null;
}

/**
 * バッチ取得用の動画データ
 */
export interface BatchVideoData {
  productId: number;
  videoUrl: string;
  videoType: string | null;
  quality: string | null;
  duration: number | null;
}

/**
 * バッチ取得用のセールデータ
 */
export interface BatchSaleData {
  productId: number;
  regularPrice: number;
  salePrice: number;
  discountPercent: number | null;
  endAt: Date | null;
}

/**
 * ソースデータ（バッチ取得用）
 */
export interface BatchSourceData {
  id: number;
  productId: number;
  aspName: string;
  originalProductId: string | null;
  affiliateUrl: string | null;
  price: number | null;
  currency: string | null;
  productType: string | null;
}

/**
 * 商品関連データのバッチ取得結果型
 */
export interface BatchRelatedDataResult {
  performersMap: Map<number, BatchPerformerData[]>;
  tagsMap: Map<number, BatchTagData[]>;
  sourcesMap: Map<number, BatchSourceData | undefined>;
  /** 全ソースのマップ（alternativeSources生成用） */
  allSourcesMap: Map<number, BatchSourceData[]>;
  imagesMap: Map<number, BatchImageData[]>;
  videosMap: Map<number, BatchVideoData[]>;
  salesMap: Map<number, BatchSaleData>;
}

export interface TagResult {
  id: number;
  name: string;
  category: string | null;
}

export interface ProviderProductCount {
  provider: string;
  count: number;
}

export interface SaleStatsResult {
  totalSaleProducts: number;
  avgDiscountPercent: number;
  maxDiscountPercent: number;
  saleEndingSoon: number;
}

/**
 * カテゴリ（タグ）と商品数
 */
export interface CategoryWithCount {
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  category: string | null;
  productCount: number;
}

/**
 * 未整理商品統計
 */
export interface UncategorizedStats {
  aspStats: Array<{ aspName: string; count: number }>;
  patternStats: Array<{ pattern: string; label: string; count: number }>;
  totalCount: number;
}

/**
 * シリーズ情報
 */
export interface SeriesInfo {
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  totalProducts: number;
  totalDuration: number;
  firstReleaseDate: string | null;
  lastReleaseDate: string | null;
  topPerformers: Array<{ id: number; name: string; count: number }>;
  averageRating: number | null;
}

/**
 * 人気シリーズ
 */
export interface PopularSeries {
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  productCount: number;
  latestReleaseDate: string | null;
}

/**
 * シリーズ基本情報（getSeriesByTagId用）
 */
export interface SeriesBasicInfo {
  id: number;
  name: string;
  totalProducts: number;
  totalDuration: number;
  products: Array<{
    id: number;
    title: string;
    imageUrl: string;
    releaseDate: string | null;
    duration: number | null;
    price: number | null;
  }>;
}

/**
 * シリーズ作品（getSeriesProducts用）
 */
export interface SeriesProduct {
  id: string;
  normalizedProductId: string;
  title: string;
  releaseDate?: string;
  duration?: number;
  thumbnail: string;
  performers: Array<{ id: number; name: string }>;
  price?: number;
  rating?: number;
  reviewCount?: number;
  hasVideo: boolean;
  aiCatchphrase?: string;
}

/**
 * 人気メーカー/レーベル
 */
export interface PopularMaker {
  id: number;
  name: string;
  category: string;
  productCount: number;
}

/**
 * メーカー傾向分析結果
 */
export interface MakerPreference {
  makerId: number;
  makerName: string;
  category: string;
  count: number;
  averageRating: number | null;
}

/**
 * メーカー/レーベル詳細情報
 */
export interface MakerInfo {
  id: number;
  name: string;
  category: 'maker' | 'label';
  productCount: number;
  averageRating: number | null;
  topPerformers: Array<{ id: number; name: string; productCount: number }>;
  topGenres: Array<{ id: number; name: string; productCount: number }>;
  yearlyStats: Array<{ year: number; count: number }>;
  recentProducts: Array<{
    id: number;
    title: string;
    imageUrl: string;
    releaseDate: string | null;
  }>;
}

// ============================================================
// Factory
// ============================================================

/**
 * コアクエリファクトリー
 */
export function createCoreQueries(deps: CoreQueryDeps) {
  const {
    getDb,
    products,
    performers,
    productPerformers,
    performerAliases,
    tags,
    productTags,
    productSources,
    productImages,
    productVideos,
    productSales,
    siteMode,
  } = deps;

  /**
   * ASPフィルタ条件を生成
   */
  function getAspFilterCondition(): SQL {
    if (siteMode === 'fanza-only') {
      return sql`EXISTS (
        SELECT 1 FROM ${productSources} ps_fanza
        WHERE ps_fanza.product_id = ${products.id}
        AND ps_fanza.asp_name = 'FANZA'
      )`;
    }

    // adult-v: FANZA専用商品を除外
    return sql`(EXISTS (
      SELECT 1 FROM ${productSources} ps_check
      WHERE ps_check.product_id = ${products.id}
      AND ps_check.asp_name != 'FANZA'
    ) OR NOT EXISTS (
      SELECT 1 FROM ${productSources} ps_fanza
      WHERE ps_fanza.product_id = ${products.id}
      AND ps_fanza.asp_name = 'FANZA'
    ))`;
  }

  /**
   * タグ一覧を取得
   */
  async function getTags(category?: string): Promise<TagResult[]> {
    const db = getDb();

    const baseQuery = db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = category
      ? await baseQuery.where(eq(tags.category, category)).orderBy(asc(tags.name))
      : await baseQuery.orderBy(asc(tags.name));

    return results.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      category: r.category as string | null,
    }));
  }

  /**
   * タグIDでタグを取得
   */
  async function getTagById(tagId: number): Promise<TagResult | null> {
    const db = getDb();

    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    if (result.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result[0] as any;
    return {
      id: r.id as number,
      name: r.name as string,
      category: r.category as string | null,
    };
  }

  /**
   * プロバイダー別商品数を取得
   */
  async function getProviderProductCounts(): Promise<Record<string, number>> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN ps.asp_name IN ('CARIBBEAN', 'CARIBBEANCOMPR', '1PONDO', 'HEYZO', '10MUSUME',
                               'PACOPACOMAMA', 'H4610', 'H0930', 'C0930', 'GACHINCO',
                               'KIN8TENGOKU', 'NYOSHIN', 'HEYDOUGA', 'X1X', 'ENKOU55',
                               'UREKKO', 'XXXURABI', 'TOKYOHOT', 'DTI') THEN 'dti'
          WHEN ps.asp_name = 'DUGA' OR ps.asp_name = 'APEX' THEN 'duga'
          WHEN ps.asp_name = 'SOKMIL' THEN 'sokmil'
          WHEN ps.asp_name = 'MGS' THEN 'mgs'
          WHEN ps.asp_name = 'FANZA' THEN 'fanza'
          WHEN ps.asp_name = 'FC2' THEN 'fc2'
          WHEN ps.asp_name = 'B10F' THEN 'b10f'
          ELSE 'other'
        END as provider,
        COUNT(DISTINCT ps.product_id) as count
      FROM ${productSources} ps
      GROUP BY provider
      ORDER BY count DESC
    `);

    const counts: Record<string, number> = {};
    for (const row of result.rows as { provider: string; count: string | number }[]) {
      counts[row.provider] = typeof row.count === 'string' ? parseInt(row.count) : row.count;
    }
    return counts;
  }

  /**
   * セール統計を取得
   */
  async function getSaleStats(aspName?: string): Promise<SaleStatsResult> {
    const db = getDb();

    const aspCondition = aspName
      ? sql`AND ps.asp_name = ${aspName}`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT psl.product_source_id) as "totalSaleProducts",
        AVG(psl.discount_percent) as "avgDiscountPercent",
        MAX(psl.discount_percent) as "maxDiscountPercent",
        COUNT(DISTINCT CASE
          WHEN psl.end_at IS NOT NULL AND psl.end_at < NOW() + INTERVAL '3 days'
          THEN psl.product_source_id
        END) as "saleEndingSoon"
      FROM ${productSales} psl
      INNER JOIN ${productSources} ps ON psl.product_source_id = ps.id
      WHERE psl.is_active = TRUE
      ${aspCondition}
    `);

    if (result.rows.length === 0) {
      return {
        totalSaleProducts: 0,
        avgDiscountPercent: 0,
        maxDiscountPercent: 0,
        saleEndingSoon: 0,
      };
    }

    const row = result.rows[0] as {
      totalSaleProducts: string | number;
      avgDiscountPercent: string | number | null;
      maxDiscountPercent: string | number | null;
      saleEndingSoon: string | number;
    };

    return {
      totalSaleProducts:
        typeof row.totalSaleProducts === 'string'
          ? parseInt(row.totalSaleProducts)
          : row.totalSaleProducts || 0,
      avgDiscountPercent:
        typeof row.avgDiscountPercent === 'string'
          ? parseFloat(row.avgDiscountPercent)
          : row.avgDiscountPercent || 0,
      maxDiscountPercent:
        typeof row.maxDiscountPercent === 'string'
          ? parseInt(row.maxDiscountPercent)
          : row.maxDiscountPercent || 0,
      saleEndingSoon:
        typeof row.saleEndingSoon === 'string'
          ? parseInt(row.saleEndingSoon)
          : row.saleEndingSoon || 0,
    };
  }

  /**
   * 人気タグを取得
   */
  async function getPopularTags(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<Array<TagResult & { productCount: number }>> {
    const db = getDb();
    const { limit = 20, category } = options;

    const categoryCondition = category
      ? sql`AND t.category = ${category}`
      : sql``;

    const aspFilter = getAspFilterCondition();

    const result = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        t.category,
        COUNT(DISTINCT pt.product_id) as "productCount"
      FROM ${tags} t
      INNER JOIN ${productTags} pt ON t.id = pt.tag_id
      INNER JOIN ${products} p ON pt.product_id = p.id
      WHERE ${aspFilter}
      ${categoryCondition}
      GROUP BY t.id, t.name, t.category
      ORDER BY "productCount" DESC
      LIMIT ${limit}
    `);

    return (result.rows as Array<{
      id: number;
      name: string;
      category: string | null;
      productCount: string | number;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      productCount:
        typeof row.productCount === 'string'
          ? parseInt(row.productCount)
          : row.productCount,
    }));
  }

  /**
   * あいまい検索用のクエリを実行
   */
  async function fuzzySearchQuery(
    searchTerm: string,
    table: 'products' | 'performers',
    limit: number = 20
  ): Promise<number[]> {
    const db = getDb();
    const escapedTerm = escapeLikePattern(searchTerm);

    if (table === 'products') {
      const result = await db
        .select({ id: products.id })
        .from(products)
        .where(
          or(
            ilike(products.title, `%${escapedTerm}%`),
            ilike(products.normalizedProductId, `%${escapedTerm}%`),
            ilike(products.description, `%${escapedTerm}%`)
          )
        )
        .limit(limit);
      return extractIds(result);
    }

    const result = await db
      .select({ id: performers.id })
      .from(performers)
      .where(
        or(
          ilike(performers.name, `%${escapedTerm}%`),
          ilike(performers.nameKana, `%${escapedTerm}%`)
        )
      )
      .limit(limit);
    return extractIds(result);
  }

  /**
   * 商品のASPソース情報を取得
   */
  async function getProductSources(productId: number) {
    try {
      const db = getDb();
      const sources = await db
        .select({
          aspName: productSources.aspName,
          originalProductId: productSources.originalProductId,
          price: productSources.price,
          currency: productSources.currency,
          affiliateUrl: productSources.affiliateUrl,
        })
        .from(productSources)
        .where(eq(productSources.productId, productId));

      return sources;
    } catch (error) {
      console.error(`Error fetching product sources for product ${productId}:`, error);
      return [];
    }
  }

  /**
   * 女優の作品に含まれるタグを取得
   */
  async function getTagsForActress(actressId: string, category?: string): Promise<TagResult[]> {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);

      if (isNaN(performerId)) {
        return [];
      }

      // まず女優の作品IDを取得
      const actressProductIds = await db
        .selectDistinct({ productId: productPerformers.productId })
        .from(productPerformers)
        .where(eq(productPerformers.performerId, performerId));

      if (actressProductIds.length === 0) {
        return [];
      }

      const productIdList = extractProductIds(actressProductIds);

      // 女優の作品に含まれるタグを取得（件数カウントなし）
      const results = await db
        .selectDistinct({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(tags)
        .innerJoin(productTags, eq(tags.id, productTags.tagId))
        .where(
          and(
            category ? eq(tags.category, category) : undefined,
            inArray(productTags.productId, productIdList)
          )
        )
        .orderBy(tags.name);

      // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
      return results.map((r) => ({
        id: r.id as number,
        name: r.name as string,
        category: r.category as string | null,
      }));
    } catch (error) {
      console.error('Error fetching tags for actress:', error);
      throw error;
    }
  }

  /**
   * 演者の別名を取得
   */
  async function getPerformerAliases(performerId: number): Promise<Array<{
    id: number;
    aliasName: string;
    source: string | null;
    isPrimary: boolean | null;
    createdAt: Date;
  }>> {
    try {
      const db = getDb();

      const aliases = await db
        .select()
        .from(performerAliases)
        .where(eq(performerAliases.performerId, performerId))
        .orderBy(desc(performerAliases.isPrimary), asc(performerAliases.aliasName));

      // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
      return aliases.map((a) => ({
        id: a.id as number,
        aliasName: a.aliasName as string,
        source: a.source as string | null,
        isPrimary: a.isPrimary as boolean | null,
        createdAt: a.createdAt as Date,
      }));
    } catch (error) {
      console.error(`Error fetching aliases for performer ${performerId}:`, error);
      return [];
    }
  }

  /**
   * 女優のサイト別作品数を取得
   */
  async function getActressProductCountBySite(actressId: string): Promise<Array<{
    siteName: string;
    count: number;
  }>> {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);

      if (isNaN(performerId)) {
        return [];
      }

      const results = await db
        .select({
          siteName: tags.name,
          count: sql<number>`COUNT(DISTINCT ${products.id})`,
        })
        .from(products)
        .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
        .innerJoin(productTags, eq(products.id, productTags.productId))
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(and(
          eq(productPerformers.performerId, performerId),
          eq(tags.category, 'site')
        ))
        .groupBy(tags.name)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

      // DIパターンのためDrizzle型推論が効かない - 明示的な型アサーションが必要
      return results.map((r) => ({
        siteName: r.siteName as string,
        count: Number(r.count),
      }));
    } catch (error) {
      console.error(`Error fetching product count by site for actress ${actressId}:`, error);
      return [];
    }
  }

  /**
   * 商品の関連データ（出演者、タグ、ソース、画像、動画）を並列取得するヘルパー関数
   */
  async function fetchProductRelatedData(productId: number): Promise<ProductRelatedData> {
    const db = getDb();
    const isValidPerformer = deps.isValidPerformer || (() => true);

    const [rawPerformerData, rawTagData, rawSourceData, rawImagesData, rawVideosData, rawSaleData] = await Promise.all([
      // 出演者情報を取得
      db
        .select({
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(eq(productPerformers.productId, productId)),

      // タグ情報を取得
      db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, productId)),

      // ASP情報を取得
      db
        .select({
          aspName: productSources.aspName,
          originalProductId: productSources.originalProductId,
          affiliateUrl: productSources.affiliateUrl,
          price: productSources.price,
          currency: productSources.currency,
        })
        .from(productSources)
        .where(eq(productSources.productId, productId))
        .limit(1),

      // サンプル画像を取得
      db
        .select({
          productId: productImages.productId,
          imageUrl: productImages.imageUrl,
          imageType: productImages.imageType,
          displayOrder: productImages.displayOrder,
        })
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(asc(productImages.displayOrder)),

      // サンプル動画を取得
      db
        .select({
          productId: productVideos.productId,
          videoUrl: productVideos.videoUrl,
          videoType: productVideos.videoType,
          quality: productVideos.quality,
          duration: productVideos.duration,
        })
        .from(productVideos)
        .where(eq(productVideos.productId, productId)),

      // セール情報を取得（アクティブなもののみ）
      db
        .select({
          regularPrice: productSales.regularPrice,
          salePrice: productSales.salePrice,
          discountPercent: productSales.discountPercent,
          endAt: productSales.endAt,
        })
        .from(productSales)
        .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
        .where(
          and(
            eq(productSources.productId, productId),
            eq(productSales.isActive, true),
            sql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`
          )
        )
        .limit(1),
    ]);

    // 型変換ヘルパーを使用してas anyを回避
    const performerData = toPerformerRows(rawPerformerData);
    const tagData = toTagRows(rawTagData);
    const sourceData = toSourceRow(rawSourceData[0]);
    const imagesData = toImageRows(rawImagesData);
    const videosData = toVideoRows(rawVideosData);

    // セールデータの変換
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSale = rawSaleData[0] as any;
    const saleData = rawSale ? {
      regularPrice: rawSale.regularPrice as number,
      salePrice: rawSale.salePrice as number,
      discountPercent: rawSale.discountPercent as number | null,
      endAt: rawSale.endAt as Date | null,
    } : undefined;

    return {
      performerData: performerData.filter(isValidPerformer),
      tagData,
      sourceData,
      imagesData,
      videosData,
      saleData,
    };
  }

  /**
   * 複数商品の関連データをバッチ取得するヘルパー関数
   * N+1問題を解消し、商品一覧の高速化に使用
   * @param productIds - 商品IDの配列
   * @param preferredProviders - 優先プロバイダー（フィルター用、オプショナル）
   * @param options - 取得オプション
   * @param options.limitImagesPerProduct - 商品あたりの画像取得数上限（一覧表示用、デフォルト: 無制限）
   * @param options.limitVideosPerProduct - 商品あたりの動画取得数上限（一覧表示用、デフォルト: 無制限）
   */
  async function batchFetchProductRelatedData(
    productIds: number[],
    preferredProviders?: string[],
    options?: {
      limitImagesPerProduct?: number;
      limitVideosPerProduct?: number;
    }
  ): Promise<BatchRelatedDataResult> {
    if (productIds.length === 0) {
      return {
        performersMap: new Map(),
        tagsMap: new Map(),
        sourcesMap: new Map(),
        allSourcesMap: new Map(),
        imagesMap: new Map(),
        videosMap: new Map(),
        salesMap: new Map(),
      };
    }

    const db = getDb();
    const limitImages = options?.limitImagesPerProduct;
    const limitVideos = options?.limitVideosPerProduct;

    // 画像クエリ: LIMITが指定されている場合はROW_NUMBERで商品あたりの件数を制限
    const imagesQuery = limitImages
      ? db.execute(sql`
          SELECT product_id, image_url, image_type, display_order
          FROM (
            SELECT
              product_id,
              image_url,
              image_type,
              display_order,
              ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY display_order ASC NULLS LAST) as rn
            FROM product_images
            WHERE product_id = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::integer[])
          ) ranked
          WHERE rn <= ${limitImages}
        `)
      : db
          .select({
            productId: productImages.productId,
            imageUrl: productImages.imageUrl,
            imageType: productImages.imageType,
            displayOrder: productImages.displayOrder,
          })
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.displayOrder));

    // 動画クエリ: LIMITが指定されている場合はROW_NUMBERで商品あたりの件数を制限
    const videosQuery = limitVideos
      ? db.execute(sql`
          SELECT product_id, video_url, video_type, quality, duration
          FROM (
            SELECT
              product_id,
              video_url,
              video_type,
              quality,
              duration,
              ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY id ASC) as rn
            FROM product_videos
            WHERE product_id = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::integer[])
          ) ranked
          WHERE rn <= ${limitVideos}
        `)
      : db
          .select({
            productId: productVideos.productId,
            videoUrl: productVideos.videoUrl,
            videoType: productVideos.videoType,
            quality: productVideos.quality,
            duration: productVideos.duration,
          })
          .from(productVideos)
          .where(inArray(productVideos.productId, productIds));

    const [allPerformers, allTags, allSources, allImages, allVideos, allSales] = await Promise.all([
      db
        .select({
          productId: productPerformers.productId,
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(inArray(productPerformers.productId, productIds)),
      db
        .select({
          productId: productTags.productId,
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(inArray(productTags.productId, productIds)),
      db
        .select({
          id: productSources.id,
          productId: productSources.productId,
          aspName: productSources.aspName,
          originalProductId: productSources.originalProductId,
          affiliateUrl: productSources.affiliateUrl,
          price: productSources.price,
          currency: productSources.currency,
          productType: productSources.productType,
        })
        .from(productSources)
        .where(inArray(productSources.productId, productIds)),
      imagesQuery,
      videosQuery,
      // アクティブなセール情報を取得
      db
        .select({
          productId: productSources.productId,
          regularPrice: productSales.regularPrice,
          salePrice: productSales.salePrice,
          discountPercent: productSales.discountPercent,
          endAt: productSales.endAt,
        })
        .from(productSales)
        .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
        .where(
          and(
            inArray(productSources.productId, productIds),
            eq(productSales.isActive, true),
            sql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`
          )
        ),
    ]);

    // Map by productId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedPerformers = allPerformers as any[];
    const performersMap = new Map<number, BatchPerformerData[]>();
    for (const p of typedPerformers) {
      const productId = p.productId as number;
      if (!performersMap.has(productId)) performersMap.set(productId, []);
      performersMap.get(productId)!.push({
        id: p.id as number,
        name: p.name as string,
        nameKana: p.nameKana as string | null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedTags = allTags as any[];
    const tagsMap = new Map<number, BatchTagData[]>();
    for (const t of typedTags) {
      const productId = t.productId as number;
      if (!tagsMap.has(productId)) tagsMap.set(productId, []);
      tagsMap.get(productId)!.push({
        id: t.id as number,
        name: t.name as string,
        category: t.category as string | null,
      });
    }

    // ソース選択（共通関数使用: siteModeに応じてソースを選択）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSources = (allSources as any[]).map((s) => ({
      id: s.id as number,
      productId: s.productId as number,
      aspName: s.aspName as string,
      originalProductId: s.originalProductId as string | null,
      affiliateUrl: s.affiliateUrl as string | null,
      price: s.price as number | null,
      currency: s.currency as string | null,
      productType: s.productType as string | null,
    }));
    const sourcesByProduct = groupSourcesByProduct(typedSources);
    const { sourcesMap } = selectProductSources(sourcesByProduct, {
      siteMode,
      preferredProviders,
      debug: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // db.executeの結果はrows配列を持つ、通常のクエリは配列を直接返す
    const rawImages = limitImages ? (allImages as { rows: any[] }).rows : allImages;
    const typedImages = rawImages as any[];
    const imagesMap = new Map<number, BatchImageData[]>();
    for (const img of typedImages) {
      // db.executeはスネークケース、通常クエリはキャメルケース
      const productId = (img.product_id ?? img.productId) as number;
      if (!imagesMap.has(productId)) imagesMap.set(productId, []);
      imagesMap.get(productId)!.push({
        productId: productId,
        imageUrl: (img.image_url ?? img.imageUrl) as string,
        imageType: (img.image_type ?? img.imageType) as string,
        displayOrder: (img.display_order ?? img.displayOrder) as number | null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // db.executeの結果はrows配列を持つ、通常のクエリは配列を直接返す
    const rawVideos = limitVideos ? (allVideos as { rows: any[] }).rows : allVideos;
    const typedVideos = rawVideos as any[];
    const videosMap = new Map<number, BatchVideoData[]>();
    for (const vid of typedVideos) {
      // db.executeはスネークケース、通常クエリはキャメルケース
      const productId = (vid.product_id ?? vid.productId) as number;
      if (!videosMap.has(productId)) videosMap.set(productId, []);
      videosMap.get(productId)!.push({
        productId: productId,
        videoUrl: (vid.video_url ?? vid.videoUrl) as string,
        videoType: (vid.video_type ?? vid.videoType) as string | null,
        quality: vid.quality as string | null,
        duration: vid.duration as number | null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSales = allSales as any[];
    const salesMap = new Map<number, BatchSaleData>();
    for (const sale of typedSales) {
      // 1商品に複数セールがある場合は最初のものを使用
      const productId = sale.productId as number;
      if (!salesMap.has(productId)) {
        salesMap.set(productId, {
          productId: sale.productId as number,
          regularPrice: sale.regularPrice as number,
          salePrice: sale.salePrice as number,
          discountPercent: sale.discountPercent as number | null,
          endAt: sale.endAt as Date | null,
        });
      }
    }

    // 全ソースのマップを作成（alternativeSources生成用）
    const allSourcesMap = new Map<number, BatchSourceData[]>();
    for (const s of typedSources) {
      const productId = s.productId;
      if (!allSourcesMap.has(productId)) {
        allSourcesMap.set(productId, []);
      }
      allSourcesMap.get(productId)!.push(s);
    }

    return { performersMap, tagsMap, sourcesMap, allSourcesMap, imagesMap, videosMap, salesMap };
  }

  /**
   * カテゴリ一覧を取得（商品数付き）
   */
  async function getCategories(options?: {
    category?: string;
    sortBy?: 'productCount' | 'name';
    limit?: number;
  }): Promise<CategoryWithCount[]> {
    try {
      const db = getDb();
      const categoryFilter = options?.category || 'genre';
      const sortBy = options?.sortBy || 'productCount';
      const limit = options?.limit || 100;

      const result = await db.execute(sql`
        SELECT
          t.id,
          t.name,
          t.name_en,
          t.name_zh,
          t.name_ko,
          t.category,
          COUNT(pt.product_id) as product_count
        FROM ${tags} t
        LEFT JOIN ${productTags} pt ON t.id = pt.tag_id
        WHERE t.category = ${categoryFilter}
        GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
        HAVING COUNT(pt.product_id) > 0
        ORDER BY ${sortBy === 'name' ? sql`t.name ASC` : sql`COUNT(pt.product_id) DESC`}
        LIMIT ${limit}
      `);

      type CategoryRow = {
        id: number;
        name: string;
        name_en: string | null;
        name_zh: string | null;
        name_ko: string | null;
        category: string | null;
        product_count: string;
      };
      const rows = (result.rows || []) as CategoryRow[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        nameEn: row.name_en,
        nameZh: row.name_zh,
        nameKo: row.name_ko,
        category: row.category,
        productCount: parseInt(row.product_count, 10),
      }));
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  /**
   * 未整理商品統計を取得
   */
  async function getUncategorizedStats(): Promise<UncategorizedStats> {
    try {
      const db = getDb();

      // ASP別統計（DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得）
      const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
      const aspResult = await db.execute(sql`
        SELECT
          ${sql.raw(aspNormalizeSql)} as asp_name,
          COUNT(DISTINCT p.id) as count
        FROM ${products} p
        LEFT JOIN ${productPerformers} pp ON p.id = pp.product_id
        LEFT JOIN ${productSources} ps ON p.id = ps.product_id
        WHERE pp.product_id IS NULL AND ps.asp_name IS NOT NULL
        GROUP BY ${sql.raw(aspNormalizeSql)}
        ORDER BY count DESC
      `);

      // 品番パターン別統計
      const patternResult = await db.execute(sql`
        SELECT
          CASE
            WHEN normalized_product_id LIKE 'SIRO-%' THEN 'SIRO'
            WHEN normalized_product_id LIKE '200GANA-%' THEN '200GANA'
            WHEN normalized_product_id LIKE 'LUXU-%' THEN 'LUXU'
            WHEN normalized_product_id LIKE 'HEYZO-%' THEN 'HEYZO'
            WHEN normalized_product_id ~ '^[0-9]{6}_[0-9]{3}$' THEN 'DTI'
            WHEN normalized_product_id ~ '^[A-Z]+-[0-9]+$' THEN 'DVD'
            ELSE 'OTHER'
          END as pattern,
          COUNT(DISTINCT p.id) as count
        FROM ${products} p
        LEFT JOIN ${productPerformers} pp ON p.id = pp.product_id
        WHERE pp.product_id IS NULL
        GROUP BY pattern
        ORDER BY count DESC
      `);

      // 総数
      const totalResult = await db.execute(sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM ${products} p
        LEFT JOIN ${productPerformers} pp ON p.id = pp.product_id
        WHERE pp.product_id IS NULL
      `);

      const patternLabels: Record<string, string> = {
        'SIRO': 'シロウトTV系',
        '200GANA': 'ナンパTV系',
        'LUXU': 'ラグジュTV系',
        'HEYZO': 'HEYZO',
        'DTI': 'DTI系(カリビ/一本道)',
        'DVD': 'DVD作品',
        'OTHER': 'その他',
      };

      type AspRow = { asp_name: string; count: string };
      type PatternRow = { pattern: string; count: string };
      type CountRow = { count: string };
      const aspRows = (aspResult.rows || []) as AspRow[];
      const patternRows = (patternResult.rows || []) as PatternRow[];
      const totalRows = (totalResult.rows || []) as CountRow[];

      return {
        aspStats: aspRows.map(row => ({
          aspName: row.asp_name,
          count: parseInt(row.count, 10),
        })),
        patternStats: patternRows.map(row => ({
          pattern: row.pattern,
          label: patternLabels[row.pattern] || row.pattern,
          count: parseInt(row.count, 10),
        })),
        totalCount: parseInt(totalRows[0]?.count || '0', 10),
      };
    } catch (error) {
      console.error('Error getting uncategorized stats:', error);
      return { aspStats: [], patternStats: [], totalCount: 0 };
    }
  }

  /**
   * wiki_crawl_dataから商品コードに対応する候補演者を取得
   */
  async function getCandidatePerformers(productCode: string): Promise<Array<{
    name: string;
    source: string;
  }>> {
    try {
      const db = getDb();

      const result = await db.execute(sql`
        SELECT DISTINCT performer_name, source
        FROM wiki_crawl_data
        WHERE product_code = ${productCode}
        LIMIT 10
      `);

      type PerformerRow = { performer_name: string; source: string };
      const rows = (result.rows || []) as PerformerRow[];
      return rows.map(row => ({
        name: row.performer_name,
        source: row.source,
      }));
    } catch (error) {
      console.error('Error getting candidate performers:', error);
      return [];
    }
  }

  /**
   * カテゴリ別の商品数を取得
   */
  async function getProductCountByCategory(
    tagId: number,
    options?: {
      initial?: string;
      includeAsp?: string[];
      excludeAsp?: string[];
      hasVideo?: boolean;
      hasImage?: boolean;
      performerType?: 'solo' | 'multi';
    }
  ): Promise<number> {
    try {
      const db = getDb();
      const initial = options?.initial || '';
      const includeAsp = options?.includeAsp || [];
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

      const result = await db.execute(sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM ${products} p
        INNER JOIN ${productTags} pt ON p.id = pt.product_id
        LEFT JOIN ${productSources} ps ON p.id = ps.product_id
        WHERE pt.tag_id = ${tagId}
        AND ${initialCondition}
        AND ${aspCondition}
        AND ${excludeAspCondition}
        AND ${videoCondition}
        AND ${imageCondition}
        AND ${performerTypeCondition}
      `);
      const rows = result.rows as { count: string }[];
      return parseInt(rows?.[0]?.count || '0', 10);
    } catch (error) {
      console.error('Error getting product count by category:', error);
      return 0;
    }
  }

  /**
   * カテゴリ別のASP統計を取得
   */
  async function getAspStatsByCategory(
    tagId: number
  ): Promise<Array<{ aspName: string; count: number }>> {
    try {
      const db = getDb();
      const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
      const result = await db.execute(sql`
        SELECT
          ${sql.raw(aspNormalizeSql)} as asp_name,
          COUNT(DISTINCT p.id) as count
        FROM ${products} p
        INNER JOIN ${productTags} pt ON p.id = pt.product_id
        INNER JOIN ${productSources} ps ON p.id = ps.product_id
        WHERE pt.tag_id = ${tagId}
        AND ps.asp_name IS NOT NULL
        GROUP BY ${sql.raw(aspNormalizeSql)}
        ORDER BY COUNT(DISTINCT p.id) DESC
      `);

      const rows = result.rows as { asp_name: string; count: string }[];
      return rows.map((row) => ({
        aspName: row.asp_name,
        count: parseInt(row.count, 10),
      }));
    } catch (error) {
      console.error('Error getting ASP stats by category:', error);
      return [];
    }
  }

  /**
   * シリーズ情報を取得
   */
  async function getSeriesInfo(seriesTagId: number): Promise<SeriesInfo | null> {
    try {
      const db = getDb();

      // シリーズタグ情報を取得
      const tagResult = await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, seriesTagId), eq(tags.category, 'series')))
        .limit(1);

      if (tagResult.length === 0) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tag = tagResult[0] as any;

      // シリーズの統計情報を取得
      const statsResult = await db.execute(sql`
        SELECT
          COUNT(DISTINCT p.id)::int as total_products,
          COALESCE(SUM(p.duration), 0)::int as total_duration,
          MIN(p.release_date) as first_release,
          MAX(p.release_date) as last_release,
          AVG(rs.average_rating)::numeric(3,2) as avg_rating
        FROM ${products} p
        JOIN ${productTags} pt ON p.id = pt.product_id
        LEFT JOIN product_rating_summary rs ON p.id = rs.product_id
        WHERE pt.tag_id = ${seriesTagId}
      `);

      const stats = statsResult.rows?.[0] as Record<string, unknown> || {};

      // トップ出演者を取得
      const performersResult = await db.execute(sql`
        SELECT
          pf.id,
          pf.name,
          COUNT(*)::int as count
        FROM ${products} p
        JOIN ${productTags} pt ON p.id = pt.product_id
        JOIN ${productPerformers} pp ON p.id = pp.product_id
        JOIN ${performers} pf ON pp.performer_id = pf.id
        WHERE pt.tag_id = ${seriesTagId}
        GROUP BY pf.id, pf.name
        ORDER BY count DESC
        LIMIT 5
      `);

      return {
        id: tag.id,
        name: tag.name,
        nameEn: tag.nameEn,
        nameZh: tag.nameZh,
        nameKo: tag.nameKo,
        totalProducts: Number(stats.total_products) || 0,
        totalDuration: Number(stats.total_duration) || 0,
        firstReleaseDate: stats.first_release ? String(stats.first_release) : null,
        lastReleaseDate: stats.last_release ? String(stats.last_release) : null,
        topPerformers: (performersResult.rows || []).map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          name: String(row.name),
          count: Number(row.count),
        })),
        averageRating: stats.avg_rating ? Number(stats.avg_rating) : null,
      };
    } catch (error) {
      console.error('Error getting series info:', error);
      return null;
    }
  }

  /**
   * 人気シリーズ一覧を取得
   */
  async function getPopularSeries(limit: number = 20): Promise<PopularSeries[]> {
    try {
      const db = getDb();

      const result = await db.execute(sql`
        SELECT
          t.id,
          t.name,
          t.name_en,
          t.name_zh,
          t.name_ko,
          COUNT(DISTINCT pt.product_id)::int as product_count,
          MAX(p.release_date) as latest_release
        FROM ${tags} t
        JOIN ${productTags} pt ON t.id = pt.tag_id
        JOIN ${products} p ON pt.product_id = p.id
        WHERE t.category = 'series'
        GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko
        HAVING COUNT(DISTINCT pt.product_id) >= 5
        ORDER BY product_count DESC
        LIMIT ${limit}
      `);

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        name: String(row.name),
        nameEn: row.name_en ? String(row.name_en) : null,
        nameZh: row.name_zh ? String(row.name_zh) : null,
        nameKo: row.name_ko ? String(row.name_ko) : null,
        productCount: Number(row.product_count),
        latestReleaseDate: row.latest_release ? String(row.latest_release) : null,
      }));
    } catch (error) {
      console.error('Error getting popular series:', error);
      return [];
    }
  }

  /**
   * 人気メーカー/レーベル一覧を取得
   */
  async function getPopularMakers(options?: {
    category?: 'maker' | 'label' | 'both';
    limit?: number;
    locale?: string;
  }): Promise<PopularMaker[]> {
    try {
      const db = getDb();
      const category = options?.category || 'both';
      const limit = options?.limit || 20;
      const locale = options?.locale || 'ja';

      const categoryCondition = category === 'both'
        ? sql`t.category IN ('maker', 'label')`
        : sql`t.category = ${category}`;

      const nameColumn = locale === 'en' ? sql`COALESCE(t.name_en, t.name)`
        : locale === 'zh' ? sql`COALESCE(t.name_zh, t.name)`
        : locale === 'ko' ? sql`COALESCE(t.name_ko, t.name)`
        : sql`t.name`;

      const result = await db.execute(sql`
        SELECT
          t.id,
          ${nameColumn} as name,
          t.category,
          COUNT(DISTINCT pt.product_id)::int as product_count
        FROM ${tags} t
        JOIN ${productTags} pt ON t.id = pt.tag_id
        WHERE ${categoryCondition}
        GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
        HAVING COUNT(DISTINCT pt.product_id) >= 5
        ORDER BY product_count DESC
        LIMIT ${limit}
      `);

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        name: String(row.name),
        category: String(row.category),
        productCount: Number(row.product_count),
      }));
    } catch (error) {
      console.error('Error fetching popular makers:', error);
      return [];
    }
  }

  /**
   * ユーザーのお気に入り作品からメーカー傾向を分析
   */
  async function analyzeMakerPreference(
    productIds: number[],
    locale: string = 'ja'
  ): Promise<MakerPreference[]> {
    try {
      if (productIds.length === 0) return [];
      const db = getDb();

      const nameColumn = locale === 'en' ? sql`COALESCE(t.name_en, t.name)`
        : locale === 'zh' ? sql`COALESCE(t.name_zh, t.name)`
        : locale === 'ko' ? sql`COALESCE(t.name_ko, t.name)`
        : sql`t.name`;

      const result = await db.execute(sql`
        SELECT
          t.id as maker_id,
          ${nameColumn} as maker_name,
          t.category,
          COUNT(pt.product_id)::text as count,
          AVG(prs.average_rating)::text as avg_rating
        FROM ${productTags} pt
        JOIN ${tags} t ON pt.tag_id = t.id
        LEFT JOIN product_rating_summary prs ON pt.product_id = prs.product_id
        WHERE pt.product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
          AND t.category IN ('maker', 'label')
        GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
        ORDER BY COUNT(pt.product_id) DESC
        LIMIT 10
      `);

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        makerId: Number(row.maker_id),
        makerName: String(row.maker_name),
        category: String(row.category),
        count: parseInt(String(row.count), 10),
        averageRating: row.avg_rating ? parseFloat(String(row.avg_rating)) : null,
      }));
    } catch (error) {
      console.error('Error analyzing maker preference:', error);
      return [];
    }
  }

  /**
   * メーカー/レーベル詳細情報を取得
   */
  async function getMakerById(makerId: number, locale: string = 'ja'): Promise<MakerInfo | null> {
    try {
      const db = getDb();

      // タグ情報を取得（メーカーまたはレーベル）
      const tagResult = await db.execute(sql`
        SELECT id, name, name_en, name_zh, name_ko, category
        FROM ${tags}
        WHERE id = ${makerId} AND category IN ('maker', 'label')
      `);

      if (!tagResult.rows || tagResult.rows.length === 0) {
        return null;
      }

      const tag = tagResult.rows[0] as Record<string, unknown>;
      const makerName = locale === 'en' ? (tag.name_en || tag.name)
        : locale === 'zh' ? (tag.name_zh || tag.name)
        : locale === 'ko' ? (tag.name_ko || tag.name)
        : tag.name;

      // 作品数と平均評価を取得
      const statsResult = await db.execute(sql`
        SELECT
          COUNT(DISTINCT pt.product_id)::text as count,
          AVG(prs.average_rating)::text as avg_rating
        FROM ${productTags} pt
        LEFT JOIN product_rating_summary prs ON pt.product_id = prs.product_id
        WHERE pt.tag_id = ${makerId}
      `);

      const statsRow = statsResult.rows?.[0] as Record<string, unknown> | undefined;
      const productCount = parseInt(String(statsRow?.count || '0'), 10);
      const averageRating = statsRow?.avg_rating
        ? parseFloat(String(statsRow.avg_rating))
        : null;

      // 人気女優トップ5
      const performersResult = await db.execute(sql`
        SELECT
          perf.id as performer_id,
          perf.name as performer_name,
          COUNT(DISTINCT pt.product_id)::text as product_count
        FROM ${productTags} pt
        JOIN ${productPerformers} pp ON pt.product_id = pp.product_id
        JOIN ${performers} perf ON pp.performer_id = perf.id
        WHERE pt.tag_id = ${makerId}
        GROUP BY perf.id, perf.name
        ORDER BY COUNT(DISTINCT pt.product_id) DESC
        LIMIT 5
      `);

      const topPerformers = (performersResult.rows || []).map((row: Record<string, unknown>) => ({
        id: Number(row.performer_id),
        name: String(row.performer_name),
        productCount: parseInt(String(row.product_count), 10),
      }));

      // 人気ジャンルトップ5
      const nameCol = locale === 'en' ? sql`g.name_en`
        : locale === 'zh' ? sql`g.name_zh`
        : locale === 'ko' ? sql`g.name_ko`
        : sql`g.name`;

      const genresResult = await db.execute(sql`
        SELECT
          g.id as genre_id,
          COALESCE(${nameCol}, g.name) as genre_name,
          COUNT(DISTINCT pt.product_id)::text as product_count
        FROM ${productTags} pt
        JOIN ${productTags} pt2 ON pt.product_id = pt2.product_id
        JOIN ${tags} g ON pt2.tag_id = g.id AND g.category = 'genre'
        WHERE pt.tag_id = ${makerId}
        GROUP BY g.id, g.name, g.name_en, g.name_zh, g.name_ko
        ORDER BY COUNT(DISTINCT pt.product_id) DESC
        LIMIT 5
      `);

      const topGenres = (genresResult.rows || []).map((row: Record<string, unknown>) => ({
        id: Number(row.genre_id),
        name: String(row.genre_name),
        productCount: parseInt(String(row.product_count), 10),
      }));

      // 年別統計
      const yearlyResult = await db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM p.release_date)::text as year,
          COUNT(DISTINCT pt.product_id)::text as count
        FROM ${productTags} pt
        JOIN ${products} p ON pt.product_id = p.id
        WHERE pt.tag_id = ${makerId} AND p.release_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM p.release_date)
        ORDER BY year DESC
        LIMIT 10
      `);

      const yearlyStats = (yearlyResult.rows || []).map((row: Record<string, unknown>) => ({
        year: parseInt(String(row.year), 10),
        count: parseInt(String(row.count), 10),
      }));

      // 最新作品5件
      const titleCol = locale === 'en' ? sql`p.title_en`
        : locale === 'zh' ? sql`p.title_zh`
        : locale === 'ko' ? sql`p.title_ko`
        : sql`p.title`;

      const recentResult = await db.execute(sql`
        SELECT DISTINCT
          p.id,
          COALESCE(${titleCol}, p.title) as title,
          p.default_thumbnail_url as image_url,
          p.release_date::text
        FROM ${products} p
        JOIN ${productTags} pt ON p.id = pt.product_id
        WHERE pt.tag_id = ${makerId}
        ORDER BY p.release_date DESC NULLS LAST
        LIMIT 5
      `);

      const recentProducts = (recentResult.rows || []).map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        title: String(row.title),
        imageUrl: String(row.image_url || ''),
        releaseDate: row.release_date ? String(row.release_date) : null,
      }));

      return {
        id: makerId,
        name: String(makerName),
        category: String(tag.category) as 'maker' | 'label',
        productCount,
        averageRating,
        topPerformers,
        topGenres,
        yearlyStats,
        recentProducts,
      };
    } catch (error) {
      console.error(`Error fetching maker ${makerId}:`, error);
      return null;
    }
  }

  /**
   * シリーズ基本情報を取得（タグIDから）
   */
  async function getSeriesByTagId(tagId: number, locale: string = 'ja'): Promise<SeriesBasicInfo | null> {
    try {
      const db = getDb();

      // タグ情報を取得
      const tagResult = await db.execute(sql`
        SELECT id, name, name_en, name_zh, name_ko
        FROM ${tags}
        WHERE id = ${tagId} AND type = 'series'
      `);

      if (!tagResult.rows || tagResult.rows.length === 0) {
        return null;
      }

      const tag = tagResult.rows[0] as Record<string, unknown>;
      const tagName = locale === 'en' ? (tag.name_en || tag.name)
        : locale === 'zh' ? (tag.name_zh || tag.name)
        : locale === 'ko' ? (tag.name_ko || tag.name)
        : tag.name;

      // タイトルのローカライズ
      const titleColumn = locale === 'en' ? sql`COALESCE(p.title_en, p.title)`
        : locale === 'zh' ? sql`COALESCE(p.title_zh, p.title)`
        : locale === 'ko' ? sql`COALESCE(p.title_ko, p.title)`
        : sql`p.title`;

      // シリーズに属する作品を取得
      const productsResult = await db.execute(sql`
        SELECT
          p.id,
          ${titleColumn} as title,
          p.image_url,
          p.release_date,
          p.duration,
          ps.price
        FROM ${products} p
        JOIN ${productTags} pt ON p.id = pt.product_id
        LEFT JOIN LATERAL (
          SELECT price FROM product_sources
          WHERE product_id = p.id
          ORDER BY price NULLS LAST
          LIMIT 1
        ) ps ON true
        WHERE pt.tag_id = ${tagId}
        ORDER BY p.release_date NULLS LAST
      `);

      const seriesProducts = (productsResult.rows || []).map((row: Record<string, unknown>) => ({
        id: row.id as number,
        title: row.title as string,
        imageUrl: row.image_url as string,
        releaseDate: row.release_date as string | null,
        duration: row.duration as number | null,
        price: row.price as number | null,
      }));

      const totalDuration = seriesProducts.reduce((sum: number, p: { duration: number | null }) => sum + (p.duration || 0), 0);

      return {
        id: tagId,
        name: tagName as string,
        totalProducts: seriesProducts.length,
        totalDuration,
        products: seriesProducts,
      };
    } catch (error) {
      console.error(`Error fetching series ${tagId}:`, error);
      return null;
    }
  }

  /**
   * シリーズ内の作品リストを取得（完走ガイド用）
   */
  async function getSeriesProducts(
    seriesTagId: number,
    options?: {
      sortBy?: 'releaseDateAsc' | 'releaseDateDesc' | 'ratingDesc';
      locale?: string;
    }
  ): Promise<SeriesProduct[]> {
    try {
      const db = getDb();
      const locale = options?.locale || 'ja';
      const sortBy = options?.sortBy || 'releaseDateAsc';

      // 基本クエリ
      const result = await db.execute(sql`
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          CASE WHEN ${locale} = 'en' THEN COALESCE(p.title_en, p.title)
               WHEN ${locale} = 'zh' THEN COALESCE(p.title_zh, p.title)
               WHEN ${locale} = 'ko' THEN COALESCE(p.title_ko, p.title)
               ELSE p.title END as localized_title,
          p.release_date,
          p.duration,
          p.default_thumbnail_url,
          p.ai_catchphrase,
          (
            SELECT json_agg(json_build_object('id', pf.id, 'name', pf.name))
            FROM ${productPerformers} pp
            JOIN ${performers} pf ON pp.performer_id = pf.id
            WHERE pp.product_id = p.id
          ) as performers,
          (
            SELECT MIN(ps.price)
            FROM ${productSources} ps
            WHERE ps.product_id = p.id
          ) as min_price,
          (
            SELECT AVG(rs.average_rating)::numeric(3,2)
            FROM product_rating_summary rs
            WHERE rs.product_id = p.id
          ) as avg_rating,
          (
            SELECT SUM(rs.total_reviews)::int
            FROM product_rating_summary rs
            WHERE rs.product_id = p.id
          ) as total_reviews,
          (
            SELECT pi.image_url
            FROM ${productImages} pi
            WHERE pi.product_id = p.id AND pi.image_type = 'thumbnail'
            ORDER BY pi.display_order
            LIMIT 1
          ) as thumbnail_url,
          (
            SELECT EXISTS(
              SELECT 1 FROM ${productVideos} pv WHERE pv.product_id = p.id
            )
          ) as has_video
        FROM ${products} p
        JOIN ${productTags} pt ON p.id = pt.product_id
        WHERE pt.tag_id = ${seriesTagId}
        ORDER BY ${sortBy === 'ratingDesc'
          ? sql`avg_rating DESC NULLS LAST`
          : sortBy === 'releaseDateDesc'
          ? sql`p.release_date DESC NULLS LAST`
          : sql`p.release_date ASC NULLS LAST`}
      `);

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        normalizedProductId: String(row.normalized_product_id || ''),
        title: String(row.localized_title || row.title),
        releaseDate: row.release_date ? String(row.release_date) : undefined,
        duration: row.duration ? Number(row.duration) : undefined,
        thumbnail: String(row.thumbnail_url || row.default_thumbnail_url || ''),
        performers: (row.performers as Array<{ id: number; name: string }>) || [],
        price: row.min_price ? Number(row.min_price) : undefined,
        rating: row.avg_rating ? Number(row.avg_rating) : undefined,
        reviewCount: row.total_reviews ? Number(row.total_reviews) : undefined,
        hasVideo: Boolean(row.has_video),
        aiCatchphrase: row.ai_catchphrase ? String(row.ai_catchphrase) : undefined,
      }));
    } catch (error) {
      console.error('Error getting series products:', error);
      return [];
    }
  }

  return {
    getAspFilterCondition,
    getTags,
    getTagById,
    getProviderProductCounts,
    getSaleStats,
    getPopularTags,
    fuzzySearchQuery,
    getProductSources,
    getTagsForActress,
    getPerformerAliases,
    getActressProductCountBySite,
    fetchProductRelatedData,
    batchFetchProductRelatedData,
    getCategories,
    getUncategorizedStats,
    getCandidatePerformers,
    getProductCountByCategory,
    getAspStatsByCategory,
    getSeriesInfo,
    getPopularSeries,
    getPopularMakers,
    analyzeMakerPreference,
    getMakerById,
    getSeriesByTagId,
    getSeriesProducts,
  };
}

export type CoreQueries = ReturnType<typeof createCoreQueries>;
