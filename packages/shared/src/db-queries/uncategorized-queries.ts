/**
 * 未整理商品クエリ
 * getUncategorizedProducts/getUncategorizedProductsCount共通化
 */
import { sql, type SQL } from 'drizzle-orm';
import type { SiteMode } from './asp-filter';
import { buildAspNormalizationSql } from '../lib/asp-utils';
import { getLocalizedTitle, getLocalizedDescription } from '../localization';
import { logDbErrorAndThrow } from '../lib/db-logger';
import type { ProductRelatedData } from './core-queries';

// ============================================================
// Types
// ============================================================

export interface UncategorizedProductsOptions {
  limit?: number;
  offset?: number;
  pattern?: string;
  initial?: string;
  includeAsp?: string[];
  excludeAsp?: string[];
  hasVideo?: boolean;
  hasImage?: boolean;
  locale?: string;
  sortBy?: string;
}

export type UncategorizedProductsCountOptions = Omit<UncategorizedProductsOptions, 'limit' | 'offset' | 'locale' | 'sortBy'>;

export interface RawProductRow {
  id: number;
  title: string | null;
  title_en: string | null;
  title_zh: string | null;
  title_zh_tw: string | null;
  title_ko: string | null;
  description: string | null;
  description_en: string | null;
  description_zh: string | null;
  description_zh_tw: string | null;
  description_ko: string | null;
  default_thumbnail_url: string | null;
  duration: number | null;
  release_date: string | null;
  created_at: string | null;
  normalized_product_id: string | null;
  maker_product_code: string | null;
  ai_description: unknown | null;
}

export interface UncategorizedQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  /** サイトモード */
  siteMode: SiteMode;
  /** 商品関連データ取得関数 */
  fetchProductRelatedData: (productId: number) => Promise<ProductRelatedData>;
  /** メモリキャッシュ取得関数 */
  getFromMemoryCache: <T>(key: string) => T | null;
  /** メモリキャッシュ保存関数 */
  setToMemoryCache: <T>(key: string, value: T) => void;
}

export interface UncategorizedQueries {
  getUncategorizedProducts: <T>(options?: UncategorizedProductsOptions) => Promise<T[]>;
  getUncategorizedProductsCount: (options?: UncategorizedProductsCountOptions) => Promise<number>;
}

// ============================================================
// Factory
// ============================================================

/**
 * 未整理商品クエリファクトリー
 */
export function createUncategorizedQueries(deps: UncategorizedQueryDeps): UncategorizedQueries {
  const {
    getDb,
    siteMode,
    fetchProductRelatedData,
    getFromMemoryCache,
    setToMemoryCache,
  } = deps;

  /**
   * キャッシュキープレフィックス
   */
  const cacheKeyPrefix = siteMode === 'fanza-only' ? 'uncategorizedCount:fanza:' : 'uncategorizedCount:';

  /**
   * 品番パターン条件を構築
   */
  function buildPatternCondition(pattern: string): SQL {
    switch (pattern) {
      case 'SIRO':
        return sql`p.normalized_product_id LIKE 'SIRO-%'`;
      case '200GANA':
        return sql`p.normalized_product_id LIKE '200GANA-%'`;
      case 'LUXU':
        return sql`p.normalized_product_id LIKE 'LUXU-%'`;
      case 'HEYZO':
        return sql`p.normalized_product_id LIKE 'HEYZO-%'`;
      case 'DTI':
        return sql`p.normalized_product_id ~ '^[0-9]{6}_[0-9]{3}$'`;
      case 'DVD':
        return sql`p.normalized_product_id ~ '^[A-Z]+-[0-9]+$'`;
      case 'OTHER':
        return sql`
          p.normalized_product_id NOT LIKE 'SIRO-%'
          AND p.normalized_product_id NOT LIKE '200GANA-%'
          AND p.normalized_product_id NOT LIKE 'LUXU-%'
          AND p.normalized_product_id NOT LIKE 'HEYZO-%'
          AND p.normalized_product_id !~ '^[0-9]{6}_[0-9]{3}$'
          AND p.normalized_product_id !~ '^[A-Z]+-[0-9]+$'
        `;
      default:
        return sql`TRUE`;
    }
  }

  /**
   * 頭文字条件を構築
   */
  function buildInitialCondition(initial: string): SQL {
    if (!initial) return sql`TRUE`;

    if (initial === 'etc') {
      return sql`p.title !~ '^[あ-んア-ンa-zA-Z]'`;
    } else if (/^[A-Za-z]$/.test(initial)) {
      return sql`UPPER(LEFT(p.title, 1)) = ${initial.toUpperCase()}`;
    } else {
      return sql`LEFT(p.title, 1) = ${initial}`;
    }
  }

  /**
   * ASPフィルター条件を構築（getUncategorizedProducts用 - DTI正規化あり）
   */
  function buildAspFilterConditions(includeAsp: string[], excludeAsp: string[]): { aspCondition: SQL; excludeAspCondition: SQL } {
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');

    let aspCondition: SQL = sql`TRUE`;
    if (includeAsp.length > 0) {
      aspCondition = sql`(${sql.raw(aspNormalizeSql)}) IN (${sql.join(includeAsp.map(a => sql`${a}`), sql`, `)})`;
    }

    let excludeAspCondition: SQL = sql`TRUE`;
    if (excludeAsp.length > 0) {
      excludeAspCondition = sql`(ps.asp_name IS NULL OR (${sql.raw(aspNormalizeSql)}) NOT IN (${sql.join(excludeAsp.map(a => sql`${a}`), sql`, `)}))`;
    }

    return { aspCondition, excludeAspCondition };
  }

  /**
   * ASPフィルター条件を構築（getUncategorizedProductsCount用 - シンプル版）
   */
  function buildSimpleAspFilterConditions(includeAsp: string[], excludeAsp: string[]): { aspCondition: SQL; excludeAspCondition: SQL } {
    let aspCondition: SQL = sql`TRUE`;
    if (includeAsp.length > 0) {
      aspCondition = sql`ps.asp_name IN (${sql.join(includeAsp.map(a => sql`${a}`), sql`, `)})`;
    }

    let excludeAspCondition: SQL = sql`TRUE`;
    if (excludeAsp.length > 0) {
      excludeAspCondition = sql`(ps.asp_name IS NULL OR ps.asp_name NOT IN (${sql.join(excludeAsp.map(a => sql`${a}`), sql`, `)}))`;
    }

    return { aspCondition, excludeAspCondition };
  }

  /**
   * サンプルコンテンツ条件を構築
   */
  function buildContentConditions(hasVideo: boolean, hasImage: boolean): { videoCondition: SQL; imageCondition: SQL } {
    const videoCondition = hasVideo
      ? sql`EXISTS (SELECT 1 FROM product_videos pv WHERE pv.product_id = p.id)`
      : sql`TRUE`;

    const imageCondition = hasImage
      ? sql`EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)`
      : sql`TRUE`;

    return { videoCondition, imageCondition };
  }

  /**
   * ソート句を構築
   */
  function buildOrderByClause(sortBy: string): SQL {
    switch (sortBy) {
      case 'releaseDateAsc':
        return sql`p.release_date ASC NULLS LAST, p.created_at ASC`;
      case 'priceAsc':
        return sql`ps.price ASC NULLS LAST, p.release_date DESC NULLS LAST`;
      case 'priceDesc':
        return sql`ps.price DESC NULLS LAST, p.release_date DESC NULLS LAST`;
      case 'titleAsc':
        return sql`p.title ASC`;
      default:
        return sql`p.release_date DESC NULLS LAST, p.created_at DESC`;
    }
  }

  /**
   * サイトモードフィルター条件を構築
   */
  function buildSiteModeFilter(): SQL {
    if (siteMode === 'fanza-only') {
      // FANZAモード: FANZA商品のみ
      return sql`EXISTS (
        SELECT 1 FROM product_sources ps_fanza
        WHERE ps_fanza.product_id = p.id
        AND ps_fanza.asp_name = 'FANZA'
      )`;
    } else {
      // 全ASPモード: FANZA専用商品を除外
      return sql`NOT EXISTS (
        SELECT 1 FROM product_sources ps_fanza
        WHERE ps_fanza.product_id = p.id
        AND ps_fanza.asp_name = 'FANZA'
        AND NOT EXISTS (
          SELECT 1 FROM product_sources ps_other
          WHERE ps_other.product_id = p.id
          AND ps_other.asp_name != 'FANZA'
        )
      )`;
    }
  }

  /**
   * 未整理商品を取得
   */
  async function getUncategorizedProducts<T>(options?: UncategorizedProductsOptions): Promise<T[]> {
    try {
      const db = getDb();
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const pattern = options?.pattern || '';
      const initial = options?.initial || '';
      const includeAsp = options?.includeAsp || [];
      const excludeAsp = options?.excludeAsp || [];
      const hasVideo = options?.hasVideo || false;
      const hasImage = options?.hasImage || false;
      const locale = options?.locale || 'ja';
      const sortBy = options?.sortBy || 'releaseDateDesc';

      // 各種条件を構築
      const patternCondition = buildPatternCondition(pattern);
      const initialCondition = buildInitialCondition(initial);
      const { aspCondition, excludeAspCondition } = buildAspFilterConditions(includeAsp, excludeAsp);
      const { videoCondition, imageCondition } = buildContentConditions(hasVideo, hasImage);
      const orderByClause = buildOrderByClause(sortBy);

      // クエリ実行
      const query = sql`
        SELECT DISTINCT p.*
        FROM products p
        LEFT JOIN product_sources ps ON p.id = ps.product_id
        WHERE NOT EXISTS (
          SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
        )
        AND ${patternCondition}
        AND ${initialCondition}
        AND ${aspCondition}
        AND ${excludeAspCondition}
        AND ${videoCondition}
        AND ${imageCondition}
        ORDER BY ${orderByClause}
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const results = await db.execute(query);

      // 関連データを並列で取得
      const productsWithData = await Promise.all(
        (results.rows as unknown as RawProductRow[]).map(async (product) => {
          const { tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(product['id']);

          // ローカライズ適用
          const localizedTitle = getLocalizedTitle({
            title: product['title'] || '',
            titleEn: product.title_en,
            titleZh: product.title_zh,
            titleZhTw: product.title_zh_tw,
            titleKo: product.title_ko,
          }, locale);
          const localizedDescription = getLocalizedDescription({
            description: product['description'],
            descriptionEn: product.description_en,
            descriptionZh: product.description_zh,
            descriptionZhTw: product.description_zh_tw,
            descriptionKo: product.description_ko,
          }, locale);

          return {
            id: String(product['id']),
            title: localizedTitle,
            description: localizedDescription,
            thumbnailUrl: product.default_thumbnail_url || '',
            duration: product['duration'] || 0,
            releaseDate: product.release_date || '',
            createdAt: product.created_at || '',
            normalizedProductId: product.normalized_product_id || '',
            makerProductCode: product.maker_product_code || '',
            tags: tagData.map(t => t.name),
            sources: sourceData,
            images: imagesData.map(i => i.imageUrl),
            videos: videosData.map(v => v.videoUrl),
            // sourceDataから価格情報を取得
            price: sourceData?.price || 0,
            salePrice: undefined,
            affiliateUrl: sourceData?.affiliateUrl || '',
            provider: sourceData?.aspName || '',
          } as T;
        })
      );

      return productsWithData;
    } catch (error) {
      logDbErrorAndThrow(error, 'getUncategorizedProducts');
    }
  }

  /**
   * 未整理商品数を取得
   */
  async function getUncategorizedProductsCount(options?: UncategorizedProductsCountOptions): Promise<number> {
    try {
      const db = getDb();
      const pattern = options?.pattern || '';
      const initial = options?.initial || '';
      const includeAsp = options?.includeAsp || [];
      const excludeAsp = options?.excludeAsp || [];
      const hasVideo = options?.hasVideo || false;
      const hasImage = options?.hasImage || false;

      // フィルタなしの場合はキャッシュをチェック
      const hasFilters = pattern || initial || includeAsp.length > 0 || excludeAsp.length > 0 || hasVideo || hasImage;
      if (!hasFilters) {
        const cached = getFromMemoryCache<number>(`${cacheKeyPrefix}base`);
        if (cached !== null) return cached;
      }

      // 各種条件を構築
      const patternCondition = buildPatternCondition(pattern);
      const initialCondition = buildInitialCondition(initial);
      const { aspCondition, excludeAspCondition } = buildSimpleAspFilterConditions(includeAsp, excludeAsp);
      const { videoCondition, imageCondition } = buildContentConditions(hasVideo, hasImage);
      const siteModeFilter = buildSiteModeFilter();

      // クエリ実行
      const query = sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        LEFT JOIN product_sources ps ON p.id = ps.product_id
        WHERE NOT EXISTS (
          SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
        )
        AND ${patternCondition}
        AND ${initialCondition}
        AND ${aspCondition}
        AND ${excludeAspCondition}
        AND ${videoCondition}
        AND ${imageCondition}
        AND ${siteModeFilter}
      `;

      const result = await db.execute(query);
      const count = Number((result.rows[0] as { count: string | number }).count);

      // フィルタなしの場合はキャッシュに保存
      if (!hasFilters) {
        setToMemoryCache(`${cacheKeyPrefix}base`, count);
      }

      return count;
    } catch (error) {
      logDbErrorAndThrow(error, 'getUncategorizedProductsCount');
    }
  }

  return {
    getUncategorizedProducts,
    getUncategorizedProductsCount,
  };
}
