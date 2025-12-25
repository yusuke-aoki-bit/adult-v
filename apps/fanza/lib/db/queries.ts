import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, performerAliases, productImages, productVideos, productSales, productRatingSummary } from './schema';
import { eq, and, or, desc, asc, gte, sql, inArray, notInArray } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory, ProviderId } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider } from '@/lib/provider-utils';
import { getDtiServiceFromUrl } from '@/lib/image-utils';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { getLocalizedTitle, getLocalizedDescription, getLocalizedPerformerName, getLocalizedPerformerBio, getLocalizedTagName, getLocalizedAiReview } from '@/lib/localization';
import { unstable_cache } from 'next/cache';
import {
  generateProductIdVariations,
  normalizeProductIdForSearch,
  stripAspPrefix,
  buildAspNormalizationSql,
  normalizeAspName,
  createAspFilterCondition,
  createProviderFilterCondition,
  createMultiProviderFilterCondition,
  createExcludeProviderFilterCondition,
  createActressAspFilterCondition,
} from '@adult-v/shared';
import type { SaleProduct } from '@adult-v/shared';

/**
 * タイトルを正規化（重複排除用）
 * 空白・記号を除去し、小文字化して同じ作品を識別
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/[\s　]+/g, '') // 全角・半角スペース除去
    .replace(/[！!？?「」『』【】（）()＆&～~・:：,，。.、]/g, '') // 記号除去
    .toLowerCase();
}
// Note: generateActressId is exported from ./queries/utils.ts

// Next.js unstable_cache設定
const CACHE_REVALIDATE_SECONDS = 300; // 5分

// unstable_cacheラッパー - インスタンス間で共有されるキャッシュ
function createCachedFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  tags: string[] = [],
  revalidate: number = CACHE_REVALIDATE_SECONDS
) {
  return unstable_cache(fn, keyParts, { revalidate, tags });
}

// メモリ内キャッシュ（dev環境でのメモリリーク対策）
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

function getFromMemoryCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  memoryCache.delete(key);
  return null;
}

function setToMemoryCache<T>(key: string, data: T): void {
  // キャッシュサイズ制限（100エントリまで）
  if (memoryCache.size > 100) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
}

type DbProduct = InferSelectModel<typeof products>;
type DbPerformer = InferSelectModel<typeof performers>;

// Source/Cache types for mapProductToType
interface SourceData {
  aspName?: string;
  price?: number | null;
  currency?: string | null;
  affiliateUrl?: string;
  originalProductId?: string;
  productType?: string | null;
}

interface CacheData {
  price?: number;
  thumbnailUrl?: string;
  affiliateUrl?: string;
  sampleImages?: string[];
}

// Raw product row from SQL query
interface RawProductRow {
  id: number;
  title: string | null;
  title_en?: string | null;
  title_zh?: string | null;
  title_zh_tw?: string | null;
  title_ko?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  description_zh_tw?: string | null;
  description_ko?: string | null;
  normalized_product_id?: string | null;
  maker_product_code?: string | null;
  default_thumbnail_url?: string | null;
  release_date?: Date | null;
  duration?: number | null;
  ai_description?: string | null;
  ai_catchphrase?: string | null;
  ai_short_description?: string | null;
  ai_tags?: string | null;
  ai_review?: string | null;
  ai_review_updated_at?: Date | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

/**
 * 無効な演者データをフィルタリングするヘルパー関数
 * クローリング時のパース エラーにより生成された無効なデータを除外
 */
function isValidPerformer(performer: { name: string }): boolean {
  const name = performer.name;

  // 1文字だけの名前は無効（例: 'デ', 'ラ', 'J', 'K'）
  if (name.length <= 1) return false;

  // 矢印記号を含む名前は無効（例: 'ゆ→な'）
  if (name.includes('→')) return false;

  // 特定の無効な名前
  const invalidNames = ['デ', 'ラ', 'ゆ', 'な', '他'];
  if (invalidNames.includes(name)) return false;

  return true;
}



// ============================================================
// 商品関連データのバッチ取得ヘルパー（型定義）
// ============================================================

type PerformerData = { id: number; name: string; nameKana: string | null };
type TagData = { id: number; name: string; category: string | null };
type ImageData = { productId: number; imageUrl: string; imageType: string; displayOrder: number | null };
type VideoData = { productId: number; videoUrl: string; videoType: string | null; quality: string | null; duration: number | null };
type SaleData = { productId: number; regularPrice: number; salePrice: number; discountPercent: number | null; endAt: Date | null };

interface BatchRelatedDataResult {
  performersMap: Map<number, PerformerData[]>;
  tagsMap: Map<number, TagData[]>;
  sourcesMap: Map<number, typeof productSources.$inferSelect>;
  imagesMap: Map<number, ImageData[]>;
  videosMap: Map<number, VideoData[]>;
  salesMap: Map<number, SaleData>;
}

/**
 * 複数商品の関連データをバッチ取得するヘルパー関数
 * N+1問題を解消し、商品一覧の高速化に使用
 */
async function batchFetchProductRelatedData(
  db: ReturnType<typeof getDb>,
  productIds: number[]
): Promise<BatchRelatedDataResult> {
  if (productIds.length === 0) {
    return {
      performersMap: new Map(),
      tagsMap: new Map(),
      sourcesMap: new Map(),
      imagesMap: new Map(),
      videosMap: new Map(),
      salesMap: new Map(),
    };
  }

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
      .select()
      .from(productSources)
      .where(inArray(productSources.productId, productIds)),
    db
      .select({
        productId: productImages.productId,
        imageUrl: productImages.imageUrl,
        imageType: productImages.imageType,
        displayOrder: productImages.displayOrder,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
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
      .where(inArray(productVideos.productId, productIds)),
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
  const performersMap = new Map<number, PerformerData[]>();
  for (const p of allPerformers) {
    if (!performersMap.has(p.productId)) performersMap.set(p.productId, []);
    performersMap.get(p.productId)!.push({ id: p.id, name: p.name, nameKana: p.nameKana });
  }

  const tagsMap = new Map<number, TagData[]>();
  for (const t of allTags) {
    if (!tagsMap.has(t.productId)) tagsMap.set(t.productId, []);
    tagsMap.get(t.productId)!.push({ id: t.id, name: t.name, category: t.category });
  }

  // FANZAソースのみを選択（FANZAサイトでは規約によりFANZAアフィリエイトリンクのみ使用可能）
  const sourcesMap = new Map<number, typeof allSources[0]>();
  // まず各productIdごとにソースをグループ化
  const sourcesByProduct = new Map<number, typeof allSources>();
  for (const s of allSources) {
    if (!sourcesByProduct.has(s.productId)) sourcesByProduct.set(s.productId, []);
    sourcesByProduct.get(s.productId)!.push(s);
  }

  // FANZAソースを優先的に選択
  let fallbackCount = 0;
  for (const [productId, sources] of sourcesByProduct) {
    // FANZAソースを探す
    const fanzaSource = sources.find(s => s.aspName.toUpperCase() === 'FANZA');
    if (fanzaSource) {
      sourcesMap.set(productId, fanzaSource);
    } else {
      // FANZAソースがない場合は最初のソースを使用（通常はFANZA商品のみなので発生しないはず）
      sourcesMap.set(productId, sources[0]);
      fallbackCount++;
    }
  }

  if (fallbackCount > 0) {
    console.warn(`[batchFetch FANZA] WARNING: ${fallbackCount} products without FANZA source (using fallback)`);
  }

  const imagesMap = new Map<number, ImageData[]>();
  for (const img of allImages) {
    if (!imagesMap.has(img.productId)) imagesMap.set(img.productId, []);
    imagesMap.get(img.productId)!.push(img);
  }

  const videosMap = new Map<number, VideoData[]>();
  for (const vid of allVideos) {
    if (!videosMap.has(vid.productId)) videosMap.set(vid.productId, []);
    videosMap.get(vid.productId)!.push(vid);
  }

  const salesMap = new Map<number, SaleData>();
  for (const sale of allSales) {
    // 1商品に複数セールがある場合は最初のものを使用
    if (!salesMap.has(sale.productId)) {
      salesMap.set(sale.productId, sale);
    }
  }

  return { performersMap, tagsMap, sourcesMap, imagesMap, videosMap, salesMap };
}

/**
 * バッチ結果から商品を型変換するヘルパー関数
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
function mapProductsWithBatchData(
  productList: DbProduct[],
  batchData: BatchRelatedDataResult,
  locale: string = 'ja'
): ProductType[] {
  return productList.map((product) => {
    const performerData = (batchData.performersMap.get(product.id) || []).filter(isValidPerformer);
    const tagData = batchData.tagsMap.get(product.id) || [];
    const imagesData = batchData.imagesMap.get(product.id);
    const videosData = batchData.videosMap.get(product.id);
    const saleData = batchData.salesMap.get(product.id);
    return mapProductToType(product, performerData, tagData, batchData.sourcesMap.get(product.id), undefined, imagesData, videosData, locale, saleData);
  });
}

/**
 * 商品の関連データ（出演者、タグ、ソース、画像、動画）を並列取得するヘルパー関数
 */
async function fetchProductRelatedData(db: ReturnType<typeof getDb>, productId: number) {
  const [performerData, tagData, sourceData, imagesData, videosData] = await Promise.all([
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
      .select()
      .from(productSources)
      .where(eq(productSources.productId, productId))
      .limit(1),

    // サンプル画像を取得
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.displayOrder)),

    // サンプル動画を取得
    db
      .select()
      .from(productVideos)
      .where(eq(productVideos.productId, productId)),
  ]);

  return {
    performerData: performerData.filter(isValidPerformer),
    tagData,
    sourceData: sourceData[0],
    imagesData,
    videosData,
  };
}

/**
 * 商品をIDで取得
 * @param id - 商品ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getProductById(id: string, locale: string = 'ja'): Promise<ProductType | null> {
  try {
    const db = getDb();

    // 商品の基本情報を取得
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, parseInt(id)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const product = result[0];

    // 関連データを並列で取得
    const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

    return mapProductToType(product, performerData, tagData, sourceData, undefined, imagesData, videosData, locale);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
}

/**
 * 商品を商品IDで検索（normalizedProductIdまたはoriginalProductId）
 * 品番のバリエーション（ハイフンあり/なし、大文字/小文字）にも対応
 * @param productId - 商品ID（正規化済みまたはオリジナル）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function searchProductByProductId(productId: string, locale: string = 'ja'): Promise<ProductType | null> {
  try {
    const db = getDb();

    // 品番バリエーションを生成
    const variants = generateProductIdVariations(productId);

    // まずnormalizedProductIdで検索（バリエーション対応）
    const productByNormalizedId = await db
      .select()
      .from(products)
      .where(inArray(products.normalizedProductId, variants))
      .limit(1);

    if (productByNormalizedId.length > 0) {
      const product = productByNormalizedId[0];

      // 関連データを並列で取得
      const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

      return mapProductToType(product, performerData, tagData, sourceData, undefined, imagesData, videosData, locale);
    }

    // originalProductIdで検索（バリエーション対応）
    const sourceByOriginalId = await db
      .select()
      .from(productSources)
      .where(inArray(productSources.originalProductId, variants))
      .limit(1);

    if (sourceByOriginalId.length === 0) {
      return null;
    }

    const source = sourceByOriginalId[0];

    // 商品情報を取得
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, source.productId))
      .limit(1);

    if (product.length === 0) {
      return null;
    }

    const productData = product[0];

    // 関連データを並列で取得（sourceは既に取得済みなので、出演者、タグ、画像、動画）
    const [performerData, tagData, imagesData, videosData] = await Promise.all([
      db
        .select({
          id: performers.id,
          name: performers.name,
          nameKana: performers.nameKana,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(eq(productPerformers.productId, productData.id)),

      db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, productData.id)),

      // サンプル画像を取得
      db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productData.id))
        .orderBy(asc(productImages.displayOrder)),

      // サンプル動画を取得
      db
        .select()
        .from(productVideos)
        .where(eq(productVideos.productId, productData.id)),
    ]);

    return mapProductToType(productData, performerData.filter(isValidPerformer), tagData, source, undefined, imagesData, videosData, locale);
  } catch (error) {
    console.error(`Error searching product by product ID ${productId}:`, error);
    throw error;
  }
}

/**
 * 商品一覧を取得
 */
export type SortOption =
  | 'releaseDateDesc'    // リリース日（新しい順）
  | 'releaseDateAsc'     // リリース日（古い順）
  | 'priceDesc'          // 価格（高い順）
  | 'priceAsc'           // 価格（安い順）
  | 'ratingDesc'         // 評価（高い順）
  | 'ratingAsc'          // 評価（低い順）
  | 'reviewCountDesc'    // レビュー数（多い順）
  | 'durationDesc'       // 再生時間（長い順）
  | 'durationAsc'        // 再生時間（短い順）
  | 'titleAsc'           // タイトル（あいうえお順）
  | 'random';            // ランダム

export interface GetProductsOptions {
  limit?: number;
  offset?: number;
  ids?: number[]; // 特定のIDリストで取得（バッチ取得用）
  category?: string;
  provider?: string;
  providers?: string[]; // 複数プロバイダー/ASPでフィルタ（いずれかを含む）
  excludeProviders?: string[]; // 除外プロバイダー/ASPの配列（いずれも含まない）
  actressId?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  query?: string;
  sortBy?: SortOption;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[]; // 対象タグIDの配列（いずれかを含む）
  excludeTags?: string[]; // 除外タグIDの配列（いずれも含まない）
  hasVideo?: boolean; // サンプル動画ありのみ
  hasImage?: boolean; // サンプル画像ありのみ
  performerType?: 'solo' | 'multi'; // 出演形態: solo=単体出演, multi=複数出演
  onSale?: boolean; // セール中のみ
  uncategorized?: boolean; // 未整理作品のみ（出演者なし）
  locale?: string; // ロケール（'ja' | 'en' | 'zh' | 'ko'）
}

export async function getProducts(options?: GetProductsOptions): Promise<ProductType[]> {
  try {
    const db = getDb();
    const conditions = [];

    // FANZAサイトではFANZA商品のみを表示（規約により他ASP商品は表示禁止）
    // 共有関数を使用: createAspFilterCondition(products, productSources, 'fanza-only')
    conditions.push(createAspFilterCondition(products, productSources, 'fanza-only'));

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
      const priceConditions = [];
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
        // EXISTSを使用
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
        // EXISTSを使用
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
        // NOT EXISTSを使用
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
    // 品番パターン（例: 390JNT-113, SSIS-865, abc00123）を検出して品番検索を優先
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    // 価格ソートの場合は特別な処理が必要（productSourcesとJOIN）
    if (options?.sortBy === 'priceAsc' || options?.sortBy === 'priceDesc') {
      // 価格でソートする場合、productSourcesとJOINしてソート
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

      // バッチでデータを取得（共通ヘルパー使用）
      const productList = results.map(r => r.product);
      const productIds = productList.map(p => p.id);
      if (productIds.length === 0) return [];

      const batchData = await batchFetchProductRelatedData(db, productIds);
      const mappedProducts = mapProductsWithBatchData(productList, batchData, options?.locale || 'ja');

      // タイトルベースの重複排除（最安のASPを優先）
      const productsByTitle = new Map<string, typeof mappedProducts[0]>();
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

      // バッチでデータを取得（共通ヘルパー使用）
      const productList = results.map(r => r.product);
      const productIds = productList.map(p => p.id);
      if (productIds.length === 0) return [];

      const batchData = await batchFetchProductRelatedData(db, productIds);
      const mappedProducts = mapProductsWithBatchData(productList, batchData, options?.locale || 'ja');

      // タイトルベースの重複排除（最安のASPを優先）
      const productsByTitle = new Map<string, typeof mappedProducts[0]>();
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
    }

    // 通常のソート処理
    // NULLS LAST を使用して、配信日未定の商品は最後に配置
    let orderByClause;
    switch (options?.sortBy) {
      case 'releaseDateAsc':
        // 品番ID (normalizedProductId) を第2ソートキーにして安定ソート
        orderByClause = [sql`${products.releaseDate} ASC NULLS LAST`, asc(products.normalizedProductId)];
        break;
      case 'titleAsc':
        // タイトル同一時は品番IDでソート
        orderByClause = [asc(products.title), asc(products.normalizedProductId)];
        break;
      case 'durationDesc':
        orderByClause = [desc(sql`COALESCE(${products.duration}, 0)`), sql`${products.releaseDate} DESC NULLS LAST`, desc(products.normalizedProductId)];
        break;
      case 'durationAsc':
        orderByClause = [asc(sql`COALESCE(${products.duration}, 0)`), sql`${products.releaseDate} DESC NULLS LAST`, asc(products.normalizedProductId)];
        break;
      case 'random':
        orderByClause = [sql`RANDOM()`];
        break;
      case 'releaseDateDesc':
      default:
        // 品番ID (normalizedProductId) を第2ソートキーにして安定ソート
        orderByClause = [sql`${products.releaseDate} DESC NULLS LAST`, desc(products.normalizedProductId)];
        break;
    }

    const results = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    // バッチでデータを取得（共通ヘルパー使用）
    const productIds = results.map(p => p.id);
    if (productIds.length === 0) return [];

    const batchData = await batchFetchProductRelatedData(db, productIds);
    const mappedProducts = mapProductsWithBatchData(results, batchData, options?.locale || 'ja');

    // タイトルベースの重複排除（同じ作品が異なるASPで複数存在する場合、最安のASPを優先）
    const productsByTitle = new Map<string, typeof mappedProducts[0]>();
    for (const product of mappedProducts) {
      const normalizedTitleKey = normalizeTitle(product.title);

      const existing = productsByTitle.get(normalizedTitleKey);
      if (!existing) {
        productsByTitle.set(normalizedTitleKey, product);
      } else {
        // 最安価格の商品を優先（salePriceがあればそれを使用、なければprice）
        const existingPrice = existing.salePrice || existing.price || Infinity;
        const currentPrice = product.salePrice || product.price || Infinity;
        if (currentPrice < existingPrice) {
          productsByTitle.set(normalizedTitleKey, product);
        }
      }
    }

    // 元の順序を維持しながら重複を除去
    const seenTitles = new Set<string>();
    const deduplicatedProducts = mappedProducts.filter(product => {
      const normalizedTitleKey = normalizeTitle(product.title);

      if (seenTitles.has(normalizedTitleKey)) {
        return false;
      }
      seenTitles.add(normalizedTitleKey);
      // 最安の商品かどうかをチェック
      const cheapest = productsByTitle.get(normalizedTitleKey);
      return cheapest?.id === product.id;
    });

    return deduplicatedProducts;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * 商品数を取得（フィルタ条件付き）
 * getProductsと同じ条件でカウントのみ取得
 */
export async function getProductsCount(options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>): Promise<number> {
  try {
    const db = getDb();
    const conditions = [];

    // プロバイダー（ASP）でフィルタ（単一）
    if (options?.provider) {
      conditions.push(createProviderFilterCondition(products, productSources, options.provider));
    }

    // 複数プロバイダー（ASP）でフィルタ
    if (options?.providers && options.providers.length > 0) {
      conditions.push(createMultiProviderFilterCondition(products, productSources, options.providers));
    }

    // 除外プロバイダー（ASP）でフィルタ（いずれも含まない）
    if (options?.excludeProviders && options.excludeProviders.length > 0) {
      conditions.push(createExcludeProviderFilterCondition(products, productSources, options.excludeProviders));
    }

    // 女優IDでフィルタ
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
      conditions.push(
        sql`(
          SELECT COUNT(*) FROM ${productPerformers} pp
          WHERE pp.product_id = ${products.id}
        ) = 1`
      );
    } else if (options?.performerType === 'multi') {
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .where(whereClause);

    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('Error counting products:', error);
    // タイムアウトエラーの場合は0を返す（UIでエラー表示を避ける）
    return 0;
  }
}

/**
 * 女優IDで商品を取得
 * @param actressId - 女優ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getProductsByActress(actressId: string, locale: string = 'ja'): Promise<ProductType[]> {
  try {
    return await getProducts({ actressId, sortBy: 'releaseDateDesc', limit: 1000, locale });
  } catch (error) {
    console.error(`Error fetching products for actress ${actressId}:`, error);
    throw error;
  }
}

/**
 * 女優一覧を取得
 */
export type ActressSortOption =
  | 'nameAsc'           // 名前（あいうえお順）
  | 'nameDesc'          // 名前（逆順）
  | 'productCountDesc'  // 作品数（多い順）
  | 'productCountAsc'   // 作品数（少ない順）
  | 'recent';           // 新着順

export async function getActresses(options?: {
  limit?: number;
  offset?: number;
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
  sortBy?: ActressSortOption;
  excludeInitials?: boolean; // 'etc'フィルタ用: 50音・アルファベット以外
  includeAsps?: string[]; // ASPでフィルタ（いずれかを含む）
  excludeAsps?: string[]; // ASPで除外（いずれも含まない）
  hasVideo?: boolean; // サンプル動画のある作品を持つ女優のみ
  hasImage?: boolean; // サンプル画像のある作品を持つ女優のみ
  hasReview?: boolean; // AIレビューのある女優のみ
  locale?: string; // ロケール（'ja' | 'en' | 'zh' | 'ko'）
  // 女優特徴フィルター
  cupSizes?: string[]; // カップサイズ（複数選択可）
  heightMin?: number; // 身長最小値（cm）
  heightMax?: number; // 身長最大値（cm）
  bloodTypes?: string[]; // 血液型（複数選択可）
}): Promise<ActressType[]> {
  try {
    const db = getDb();

    const conditions = [];

    // FANZAサイトではFANZA商品に出演している女優のみ表示（規約により他ASP専用女優は表示禁止）
    conditions.push(createActressAspFilterCondition(performers, 'fanza-only'));

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
      try {
        const tagIds = options.includeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
        if (tagIds.length > 0) {
          // このタグのいずれかを持つ商品に出演している女優IDを取得
          const performerIds = await db
            .selectDistinct({ performerId: productPerformers.performerId })
            .from(productTags)
            .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
            .where(inArray(productTags.tagId, tagIds));

          if (performerIds.length > 0) {
            const performerIdValues = performerIds.map(p => p.performerId);
            conditions.push(
              inArray(performers.id, performerIdValues)
            );
          } else {
            // 該当女優なし
            return [];
          }
        }
      } catch (includeTagsError) {
        console.error('[GET ACTRESSES] Error in includeTags processing:', includeTagsError);
        throw includeTagsError;
      }
    }

    // 除外タグでフィルタ（いずれも含まない）
    if (options?.excludeTags && options.excludeTags.length > 0) {
      try {
        const tagIds = options.excludeTags.map(t => parseInt(t)).filter(id => !isNaN(id));
        if (tagIds.length > 0) {
          // この除外タグのいずれかを持つ商品に出演している女優IDを取得
          const excludedPerformerIds = await db
            .selectDistinct({ performerId: productPerformers.performerId })
            .from(productTags)
            .innerJoin(productPerformers, eq(productTags.productId, productPerformers.productId))
            .where(inArray(productTags.tagId, tagIds));

          if (excludedPerformerIds.length > 0) {
            const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
            conditions.push(
              notInArray(performers.id, excludedPerformerIdValues)
            );
          }
        }
      } catch (excludeTagsError) {
        console.error('[GET ACTRESSES] Error in excludeTags processing:', excludeTagsError);
        throw excludeTagsError;
      }
    }

    // ASPフィルタ（いずれかを含む）
    if (options?.includeAsps && options.includeAsps.length > 0) {
      try {
        // このASPのいずれかを持つ商品に出演している女優IDを取得
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productSources)
          .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
          .where(inArray(productSources.aspName, options.includeAsps));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
          );
        } else {
          // 該当女優なし
          return [];
        }
      } catch (includeAspsError) {
        console.error('[GET ACTRESSES] Error in includeAsps processing:', includeAspsError);
        throw includeAspsError;
      }
    }

    // ASP除外フィルタ（いずれも含まない）
    if (options?.excludeAsps && options.excludeAsps.length > 0) {
      try {
        // この除外ASPのいずれかを持つ商品に出演している女優IDを取得
        const excludedPerformerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productSources)
          .innerJoin(productPerformers, eq(productSources.productId, productPerformers.productId))
          .where(inArray(productSources.aspName, options.excludeAsps));

        if (excludedPerformerIds.length > 0) {
          const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
          conditions.push(
            notInArray(performers.id, excludedPerformerIdValues)
          );
        }
      } catch (excludeAspsError) {
        console.error('[GET ACTRESSES] Error in excludeAsps processing:', excludeAspsError);
        throw excludeAspsError;
      }
    }

    // hasVideoフィルタ（サンプル動画のある作品を持つ女優のみ）
    if (options?.hasVideo) {
      try {
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productVideos)
          .innerJoin(productPerformers, eq(productVideos.productId, productPerformers.productId));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
          );
        } else {
          return [];
        }
      } catch (hasVideoError) {
        console.error('[GET ACTRESSES] Error in hasVideo processing:', hasVideoError);
        throw hasVideoError;
      }
    }

    // hasImageフィルタ（サンプル画像のある作品を持つ女優のみ）
    if (options?.hasImage) {
      try {
        const performerIds = await db
          .selectDistinct({ performerId: productPerformers.performerId })
          .from(productImages)
          .innerJoin(productPerformers, eq(productImages.productId, productPerformers.productId));

        if (performerIds.length > 0) {
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
          );
        } else {
          return [];
        }
      } catch (hasImageError) {
        console.error('[GET ACTRESSES] Error in hasImage processing:', hasImageError);
        throw hasImageError;
      }
    }

    // hasReviewフィルタ（AIレビューのある女優のみ）
    if (options?.hasReview) {
      conditions.push(sql`${performers.aiReview} IS NOT NULL`);
    }

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

    // 検索クエリ（名前・別名・AIレビューを検索）
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      try {
        // 別名から一致する女優IDを取得
        // 頭文字検索（1文字）の場合は前方一致、2文字以上のヘッダー検索は中間一致
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

        // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
        // 主名前、カナ名、別名、またはAIレビューのいずれかに一致
        // 頭文字検索の場合、nameKanaでのみ検索（ひらがな頭文字→漢字名はマッチしないため）
        const nameConditions = isInitialSearch
          ? sql`${performers.nameKana} IS NOT NULL AND ${performers.nameKana} ILIKE ${searchPattern}`
          : or(
              sql`similarity(${performers.name}, ${options.query}) > 0.2`,
              sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
              sql`${performers.name} ILIKE ${searchPattern}`,
              sql`${performers.nameKana} ILIKE ${searchPattern}`,
              // AIレビュー本文も検索対象に追加（2文字以上の検索時のみ）
              sql`${performers.aiReview} ILIKE ${searchPattern}`
            )!;

        // 別名から一致した女優IDがあれば追加
        if (matchingPerformerIds.length > 0) {
          conditions.push(
            or(
              nameConditions,
              inArray(performers.id, matchingPerformerIds.map(p => p.performerId))
            )!
          );
        } else {
          conditions.push(nameConditions);
        }
      } catch (queryError) {
        console.error('[GET ACTRESSES] Error in query processing:', queryError);
        throw queryError;
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ソート処理
    const sortBy = options?.sortBy || 'nameAsc';

    if (sortBy === 'productCountDesc' || sortBy === 'productCountAsc') {
      try {
        // 作品数順の場合は、事前計算済みのrelease_countを使用
        // JOINなしで高速にソート可能
        // 同じ作品数の場合はperformer.idでソートして順序を安定させる
        const results = await db
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

        // バッチでサムネイル、ASPサービス、別名を取得（作品数は事前計算済み）
        const performerIds = results.map(p => p.id);
        const [thumbnails, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
          batchGetPerformerAliases(db, performerIds),
        ]);

        const locale = options?.locale || 'ja';
        const actresses = results
          .map(performer => mapPerformerToActressTypeSync(
            performer,
            performer.releaseCount || 0,
            thumbnails.get(performer.id),
            servicesMap.get(performer.id),
            aliasesMap.get(performer.id),
            locale
          ));

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in product count sort:', sortError);
        throw sortError;
      }
    } else if (sortBy === 'recent') {
      try {
        // 新着順の場合は、事前計算済みのlatest_release_dateを使用
        // JOINなしで高速にソート可能
        // latest_release_dateがNULLの場合は最低優先順位（NULLS LAST）
        // 同じ日付の場合はperformer.idでソートして順序を安定させる
        const results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(sql`${performers.latestReleaseDate} DESC NULLS LAST`, desc(performers.id))
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチでサムネイル、ASPサービス、別名を取得（作品数は事前計算済み）
        const performerIds = results.map(p => p.id);
        const [thumbnails, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
          batchGetPerformerAliases(db, performerIds),
        ]);

        const locale = options?.locale || 'ja';
        const actresses = results
          .map(performer => mapPerformerToActressTypeSync(
            performer,
            performer.releaseCount || 0,
            thumbnails.get(performer.id),
            servicesMap.get(performer.id),
            aliasesMap.get(performer.id),
            locale
          ));

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in recent sort:', sortError);
        throw sortError;
      }
    } else {
      try {
        // 名前順（読み仮名があれば読み仮名でソート、なければ名前でソート）
        // 同じ名前の場合はperformer.idでソートして順序を安定させる
        // SQLite/D1ではTRANSLATE関数が使えないため、nameKanaを直接使用
        // カタカナとひらがなは同じ五十音順でソートされる
        // nameKanaがない場合は末尾に配置（COALESCE使用）
        let orderByClauses;
        switch (sortBy) {
          case 'nameAsc':
            // NULLを末尾に配置するためCOALESCEで空文字の代わりに'ん'より後の文字を使用
            orderByClauses = [asc(sql`COALESCE(${performers.nameKana}, '龠')`), asc(performers.id)];
            break;
          case 'nameDesc':
            // NULLを先頭に配置するためCOALESCEで空文字を使用
            orderByClauses = [desc(sql`COALESCE(${performers.nameKana}, '')`), desc(performers.id)];
            break;
          default:
            orderByClauses = [asc(sql`COALESCE(${performers.nameKana}, '龠')`), asc(performers.id)];
        }

        const results = await db
          .select()
          .from(performers)
          .where(whereClause)
          .orderBy(...orderByClauses)
          .limit(options?.limit || 100)
          .offset(options?.offset || 0);

        // バッチでサムネイル、ASPサービス、別名を取得（作品数は事前計算済み）
        const performerIds = results.map(p => p.id);
        const [thumbnails, servicesMap, aliasesMap] = await Promise.all([
          batchGetPerformerThumbnails(db, performerIds),
          batchGetPerformerServices(db, performerIds),
          batchGetPerformerAliases(db, performerIds),
        ]);

        const locale = options?.locale || 'ja';
        const actresses = results
          .map(performer => mapPerformerToActressTypeSync(
            performer,
            performer.releaseCount || 0,
            thumbnails.get(performer.id),
            servicesMap.get(performer.id),
            aliasesMap.get(performer.id),
            locale
          ));

        return actresses;
      } catch (sortError) {
        console.error('[GET ACTRESSES] Error in name sort:', sortError);
        throw sortError;
      }
    }
  } catch (error) {
    // Create a simplified error for React Server Components serialization
    // Only include message, no stack or other properties
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch actresses: ${errorMessage}`);
  }
}

/**
 * バッチで複数女優の作品数を取得
 * 注: FANZAサイトではFANZA商品のみをカウント（規約により他ASP商品は表示禁止）
 */
async function _batchGetPerformerProductCounts(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, number>> {
  if (performerIds.length === 0) return new Map();

  // FANZAサイトではFANZA商品のみをカウント
  const results = await db.execute<{ performer_id: number; count: string }>(sql`
    SELECT
      pp.performer_id,
      COUNT(*) as count
    FROM product_performers pp
    INNER JOIN product_sources ps ON pp.product_id = ps.product_id
    WHERE pp.performer_id IN (${sql.join(performerIds.map(id => sql`${id}`), sql`, `)})
      AND ps.asp_name = 'FANZA'
    GROUP BY pp.performer_id
  `);

  const map = new Map<number, number>();
  for (const r of results.rows) {
    map.set(r.performer_id, Number(r.count));
  }
  return map;
}

/**
 * バッチで複数女優のサムネイル画像を取得（最新作品のサムネイルを使用）
 * DISTINCT ON を使用して各女優につき1件だけ取得（ROW_NUMBERより高速）
 */
async function batchGetPerformerThumbnails(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string>> {
  if (performerIds.length === 0) return new Map();

  // 各女優のサムネイルURLを取得（DTI以外を優先、各女優につき1件のみ）
  // DISTINCT ON を使用（PostgreSQL固有だがROW_NUMBER()より高速）
  const results = await db.execute<{ performer_id: number; thumbnail_url: string }>(sql`
    SELECT DISTINCT ON (pp.performer_id)
      pp.performer_id,
      p.default_thumbnail_url as thumbnail_url
    FROM product_performers pp
    INNER JOIN products p ON pp.product_id = p.id
    INNER JOIN product_sources ps ON pp.product_id = ps.product_id
    WHERE pp.performer_id IN (${sql.join(performerIds.map(id => sql`${id}`), sql`, `)})
      AND p.default_thumbnail_url IS NOT NULL
      AND p.default_thumbnail_url != ''
    ORDER BY
      pp.performer_id,
      CASE WHEN ps.asp_name != 'DTI' THEN 0 ELSE 1 END,
      p.created_at DESC
  `);

  const map = new Map<number, string>();
  for (const r of results.rows) {
    if (r.thumbnail_url) {
      map.set(r.performer_id, r.thumbnail_url);
    }
  }
  return map;
}

/**
 * バッチで複数女優のASPサービス一覧を取得
 * DTI系サービスはサムネイルURLからサービスを判別して個別に分類
 */
async function batchGetPerformerServices(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string[]>> {
  if (performerIds.length === 0) return new Map();

  // DTI系の場合はサムネイルURLも取得してサービスを判別
  const results = await db
    .selectDistinct({
      performerId: productPerformers.performerId,
      aspName: productSources.aspName,
      thumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(productPerformers)
    .innerJoin(products, eq(productPerformers.productId, products.id))
    .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
    .where(inArray(productPerformers.performerId, performerIds));

  const map = new Map<number, string[]>();
  for (const r of results) {
    if (!r.aspName) continue;

    let serviceName = r.aspName;

    // DTI系の場合、サムネイルURLからサービスを判別
    if (r.aspName.toUpperCase() === 'DTI' && r.thumbnailUrl) {
      const dtiService = getDtiServiceFromUrl(r.thumbnailUrl);
      if (dtiService) {
        serviceName = dtiService;
      } else {
        // サービス判別できない場合は小文字の'dti'
        serviceName = 'dti';
      }
    } else {
      // DTI以外は小文字に正規化
      serviceName = r.aspName.toLowerCase();
    }

    const services = map.get(r.performerId) || [];
    if (!services.includes(serviceName)) {
      services.push(serviceName);
      map.set(r.performerId, services);
    }
  }
  return map;
}

/**
 * バッチで複数女優の別名を取得
 */
async function batchGetPerformerAliases(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, string[]>> {
  if (performerIds.length === 0) return new Map();

  const results = await db
    .select({
      performerId: performerAliases.performerId,
      aliasName: performerAliases.aliasName,
      isPrimary: performerAliases.isPrimary,
    })
    .from(performerAliases)
    .where(inArray(performerAliases.performerId, performerIds))
    .orderBy(performerAliases.performerId, desc(performerAliases.isPrimary));

  const map = new Map<number, string[]>();
  for (const r of results) {
    if (!r.aliasName || r.isPrimary) continue; // 主名は除外（既にnameに含まれる）
    const aliases = map.get(r.performerId) || [];
    if (!aliases.includes(r.aliasName)) {
      aliases.push(r.aliasName);
      map.set(r.performerId, aliases);
    }
  }
  return map;
}

/**
 * タグ一覧を取得（カテゴリ別） - シンプルなクエリ（JOINなし）
 * unstable_cacheでインスタンス間キャッシュを実現
 */
async function getTagsInternal(category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
  try {
    const db = getDb();

    // タグ一覧のみ取得（JOINなし）
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(category ? eq(tags.category, category) : undefined)
      .orderBy(tags.name);

    return results;
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
}

// unstable_cacheでラップ（カテゴリ別にキャッシュ）
const getCachedTags = createCachedFunction(
  getTagsInternal,
  ['tags-fanza'],
  ['tags'],
  CACHE_REVALIDATE_SECONDS
);

export async function getTags(category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
  return getCachedTags(category);
}

/**
 * 女優の作品に絞ったタグ一覧を取得（カテゴリ別）
 */
export async function getTagsForActress(actressId: string, category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
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

    const productIdList = actressProductIds.map(p => p.productId);

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

    return results;
  } catch (error) {
    console.error('Error fetching tags for actress:', error);
    throw error;
  }
}

/**
 * 女優の総数を取得
 */
export async function getActressesCount(options?: {
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
  excludeInitials?: boolean; // 'etc'フィルタ用: 50音・アルファベット以外
  includeAsps?: string[];
  excludeAsps?: string[];
  hasVideo?: boolean; // サンプル動画のある作品を持つ女優のみ
  hasImage?: boolean; // サンプル画像のある作品を持つ女優のみ
  hasReview?: boolean; // AIレビューのある女優のみ
  // 女優特徴フィルター
  cupSizes?: string[]; // カップサイズ（複数選択可）
  heightMin?: number; // 身長最小値（cm）
  heightMax?: number; // 身長最大値（cm）
  bloodTypes?: string[]; // 血液型（複数選択可）
}): Promise<number> {
  // TOPページ（フィルターなし）の場合はキャッシュを使用
  const hasFilters = options?.query || options?.includeTags?.length || options?.excludeTags?.length ||
    options?.excludeInitials || options?.includeAsps?.length || options?.excludeAsps?.length ||
    options?.hasVideo || options?.hasImage || options?.hasReview ||
    options?.cupSizes?.length || options?.heightMin || options?.heightMax || options?.bloodTypes?.length;

  if (!hasFilters) {
    const cached = getFromMemoryCache<number>('actressesCount:fanza:base');
    if (cached !== null) {
      return cached;
    }
  }

  try {
    const db = getDb();

    const conditions = [];

    // FANZAサイトではFANZA商品に出演している女優のみカウント（規約により他ASP専用女優は表示禁止）
    conditions.push(createActressAspFilterCondition(performers, 'fanza-only'));

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
          const performerIdValues = performerIds.map(p => p.performerId);
          conditions.push(
            inArray(performers.id, performerIdValues)
          );
        } else {
          return 0;
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
          const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
          conditions.push(
            notInArray(performers.id, excludedPerformerIdValues)
          );
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
        const performerIdValues = performerIds.map(p => p.performerId);
        conditions.push(
          inArray(performers.id, performerIdValues)
        );
      } else {
        return 0;
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
        const excludedPerformerIdValues = excludedPerformerIds.map(p => p.performerId);
        conditions.push(
          notInArray(performers.id, excludedPerformerIdValues)
        );
      }
    }

    // hasVideoフィルタ（サンプル動画のある作品を持つ女優のみ）
    if (options?.hasVideo) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productVideos)
        .innerJoin(productPerformers, eq(productVideos.productId, productPerformers.productId));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map(p => p.performerId);
        conditions.push(
          inArray(performers.id, performerIdValues)
        );
      } else {
        return 0;
      }
    }

    // hasImageフィルタ（サンプル画像のある作品を持つ女優のみ）
    if (options?.hasImage) {
      const performerIds = await db
        .selectDistinct({ performerId: productPerformers.performerId })
        .from(productImages)
        .innerJoin(productPerformers, eq(productImages.productId, productPerformers.productId));

      if (performerIds.length > 0) {
        const performerIdValues = performerIds.map(p => p.performerId);
        conditions.push(
          inArray(performers.id, performerIdValues)
        );
      } else {
        return 0;
      }
    }

    // hasReviewフィルタ（AIレビューのある女優のみ）
    if (options?.hasReview) {
      conditions.push(sql`${performers.aiReview} IS NOT NULL`);
    }

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

    // 検索クエリ（名前を検索）
    // performer_aliases テーブルも検索対象に含める
    if (options?.query) {
      // 別名から一致する女優IDを取得
      // 頭文字検索（1文字）の場合は前方一致、2文字以上のヘッダー検索は中間一致
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

      // pg_trgmを使用した類似性検索（similarity > 0.2 の結果を返す）
      // 主名前、カナ名、または別名のいずれかに一致
      // 頭文字検索の場合、nameKanaでのみ検索（ひらがな頭文字→漢字名はマッチしないため）
      const nameConditions = isInitialSearch
        ? sql`${performers.nameKana} IS NOT NULL AND ${performers.nameKana} ILIKE ${searchPattern}`
        : or(
            sql`similarity(${performers.name}, ${options.query}) > 0.2`,
            sql`similarity(${performers.nameKana}, ${options.query}) > 0.2`,
            sql`${performers.name} ILIKE ${searchPattern}`,
            sql`${performers.nameKana} ILIKE ${searchPattern}`
          )!;

      // 別名から一致した女優IDがあれば追加
      if (matchingPerformerIds.length > 0) {
        conditions.push(
          or(
            nameConditions,
            inArray(performers.id, matchingPerformerIds.map(p => p.performerId))
          )!
        );
      } else {
        conditions.push(nameConditions);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // すべての女優をカウント（商品紐付き必須を外す）
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(performers)
      .where(whereClause);

    const count = Number(result[0]?.count || 0);

    // フィルターなしの場合はキャッシュに保存
    if (!hasFilters) {
      setToMemoryCache('actressesCount:fanza:base', count);
    }

    return count;
  } catch (error) {
    console.error('Error counting actresses:', error);
    throw error;
  }
}

/**
 * 女優をIDで取得
 * @param id - 女優ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getActressById(id: string, locale: string = 'ja'): Promise<ActressType | null> {
  try {
    const db = getDb();
    const performerId = parseInt(id);

    if (isNaN(performerId)) {
      return null;
    }

    const result = await db
      .select()
      .from(performers)
      .where(eq(performers.id, performerId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return await mapPerformerToActressType(result[0], locale);
  } catch (error) {
    console.error(`Error fetching actress ${id}:`, error);
    throw error;
  }
}

/**
 * 女優の別名を取得
 */
export async function getPerformerAliases(performerId: number): Promise<Array<{
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

    return aliases;
  } catch (error) {
    console.error(`Error fetching aliases for performer ${performerId}:`, error);
    return [];
  }
}

/**
 * 女優のサイト別作品数を取得
 */
export async function getActressProductCountBySite(actressId: string): Promise<Array<{
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

    return results.map(r => ({
      siteName: r.siteName,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error(`Error fetching product count by site for actress ${actressId}:`, error);
    return [];
  }
}

/**
 * 女優のASP別作品数を取得（product_sourcesベース）
 */
export async function getActressProductCountByAsp(actressId: string): Promise<Array<{
  aspName: string;
  count: number;
}>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    // DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得
    // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    const results = await db.execute<{ asp_name: string; count: string }>(sql`
      SELECT
        ${sql.raw(aspNormalizeSql)} as asp_name,
        COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      INNER JOIN products p ON pp.product_id = p.id
      WHERE pp.performer_id = ${performerId}
      AND ps.asp_name IS NOT NULL
      GROUP BY ${sql.raw(aspNormalizeSql)}
      ORDER BY count DESC
    `);

    return (results.rows || [])
      .filter(r => r.asp_name !== null)
      .map(r => ({
        aspName: r.asp_name,
        count: parseInt(r.count, 10),
      }));
  } catch (error) {
    console.error(`Error fetching product count by ASP for actress ${actressId}:`, error);
    return [];
  }
}

/**
 * 新着商品を取得
 */
export async function getNewProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isNew: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目商品を取得
 */
export async function getFeaturedProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isFeatured: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目の女優を取得
 */
export async function getFeaturedActresses(limit = 3): Promise<ActressType[]> {
  try {
    return await getActresses({ limit });
  } catch (error) {
    console.error('Error fetching featured actresses:', error);
    throw error;
  }
}

/**
 * 商品の全ASPソース情報を取得（E-E-A-T強化用）
 */
export async function getProductSources(productId: number) {
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
 * データベースの商品をProduct型に変換
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）。指定された言語のタイトル/説明を使用
 */
function mapProductToType(
  product: DbProduct,
  performerData: Array<{ id: number; name: string; nameKana: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  tagData: Array<{ id: number; name: string; category: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  source?: SourceData,
  cache?: CacheData,
  imagesData?: Array<{ imageUrl: string; imageType: string; displayOrder: number | null }>,
  videosData?: Array<{ videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }>,
  locale: string = 'ja',
  saleData?: { regularPrice: number; salePrice: number; discountPercent: number | null; endAt?: Date | null }
): ProductType {
  // ASP情報から provider を取得
  const aspName = source?.aspName || 'DUGA';
  const mappedProvider = mapLegacyProvider(aspName);

  // ASP名を表示用ラベルにマッピング
  const providerLabelMap: Record<string, string> = {
    'APEX': 'DUGA',
    'DUGA': 'DUGA',
    'DTI': 'DTI',
    'DMM': 'DMM',
    'MGS': 'MGS動画',
    'SOKMIL': 'ソクミル',
    'ソクミル': 'ソクミル',
    'B10F': 'b10f.jp',
    'JAPANSKA': 'Japanska',
    'FC2': 'FC2',
    // DTI系サイト
    'HEYZO': 'HEYZO',
    'カリビアンコムプレミアム': 'カリビアンコムプレミアム',
    'CARIBBEANCOMPR': 'カリビアンコムプレミアム',
    'CARIBBEANCOM': 'カリビアンコム',
    '1PONDO': '一本道',
    '10MUSUME': '天然むすめ',
    'PACOPACOMAMA': 'パコパコママ',
  };
  const providerLabel = providerLabelMap[aspName.toUpperCase()] || providerLabelMap[aspName] || aspName;

  // キャッシュから価格・画像情報を取得
  const price = cache?.price || source?.price || 0;
  // 通貨情報を取得（デフォルトJPY）
  const currency = (source?.currency as 'JPY' | 'USD') || 'JPY';

  // サムネイル画像を取得（product.defaultThumbnailUrl → imagesDataのthumbnail → imagesDataの最初の画像）
  let imageUrl = cache?.thumbnailUrl || product.defaultThumbnailUrl;
  if (!imageUrl && imagesData && imagesData.length > 0) {
    // thumbnailタイプの画像を優先、なければ最初の画像
    const thumbnailImg = imagesData.find(img => img.imageType === 'thumbnail');
    imageUrl = thumbnailImg?.imageUrl || imagesData[0].imageUrl;
  }
  if (!imageUrl) {
    imageUrl = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
  }

  const affiliateUrl = source?.affiliateUrl || cache?.affiliateUrl || '';

  // サンプル画像を取得（product_imagesテーブルまたはcache）
  const sampleImages = imagesData && imagesData.length > 0
    ? imagesData.map(img => img.imageUrl)
    : (cache?.sampleImages as string[] | undefined);

  // タグからカテゴリを推定（仮実装）
  const category: ProductCategory = 'premium';

  // 出演者情報（後方互換性のため最初の1人も保持）- ローカライズ対応
  const actressId = performerData.length > 0 ? String(performerData[0].id) : undefined;
  const actressName = performerData.length > 0 ? getLocalizedPerformerName(performerData[0], locale) : undefined;

  // 全出演者情報 - ローカライズ対応
  const performersList = performerData.map(p => ({
    id: String(p.id),
    name: getLocalizedPerformerName(p, locale)
  }));

  // タグ名の配列 - ローカライズ対応
  const tagsList = tagData.map(t => getLocalizedTagName(t, locale));

  // 新作判定・発売予定判定
  const { isNew, isFuture } = product.releaseDate ? (() => {
    const releaseDate = new Date(product.releaseDate);
    const now = new Date();
    const diffTime = now.getTime() - releaseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // 未来の日付 = 発売予定
    if (diffDays < 0) {
      return { isNew: false, isFuture: true };
    }
    // 過去7日以内 = 新作
    return { isNew: diffDays <= 7, isFuture: false };
  })() : { isNew: false, isFuture: false };

  // サンプル動画を整形
  const sampleVideos = videosData && videosData.length > 0
    ? videosData.map(video => ({
        url: video.videoUrl,
        type: video.videoType || 'sample',
        quality: video.quality || undefined,
        duration: video.duration || undefined,
      }))
    : undefined;

  return {
    id: String(product.id),
    normalizedProductId: product.normalizedProductId || undefined,
    originalProductId: source?.originalProductId || undefined,
    title: getLocalizedTitle(product, locale),
    description: getLocalizedDescription(product, locale),
    price,
    currency,
    category,
    imageUrl,
    affiliateUrl,
    provider: mappedProvider,
    providerLabel,
    actressId,
    actressName,
    performers: performersList.length > 0 ? performersList : undefined,
    releaseDate: product.releaseDate || undefined,
    duration: product.duration || undefined,
    format: undefined,
    rating: undefined,
    reviewCount: undefined,
    tags: tagsList,
    isFeatured: false,
    isNew,
    isFuture,
    productType: source?.productType as 'haishin' | 'dvd' | 'monthly' | undefined,
    discount: saleData?.discountPercent || undefined,
    salePrice: saleData?.salePrice,
    regularPrice: saleData?.regularPrice,
    saleEndAt: saleData?.endAt?.toISOString(),
    reviewHighlight: undefined,
    ctaLabel: undefined,
    sampleImages,
    sampleVideos,
    // AI生成コンテンツ
    aiReview: product.aiReview || undefined,
    aiReviewUpdatedAt: product.aiReviewUpdatedAt?.toISOString(),
  };
}

const ACTRESS_PLACEHOLDER = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

/**
 * データベースの出演者(performer)をActress型に変換（同期版）
 * 画像優先順位: thumbnailUrl（作品サムネイル画像） > プレースホルダー
 * ※profileImageUrlはminnano-avから取得した画像のため使用しない
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）。指定された言語の名前/バイオを使用
 */
function mapPerformerToActressTypeSync(performer: DbPerformer, releaseCount: number, thumbnailUrl?: string, services?: string[], aliases?: string[], locale: string = 'ja'): ActressType {
  // 画像の優先順位: thumbnailUrl（作品サムネイル画像） > プレースホルダー
  // ※profileImageUrlはminnano-avから取得した画像のため使用しない
  const imageUrl = thumbnailUrl || ACTRESS_PLACEHOLDER;
  // ASP名をProviderId型に変換（共通定数を使用）
  const providerIds = (services || [])
    .map(s => ASP_TO_PROVIDER_ID[s])
    .filter((p): p is ProviderId => p !== undefined);

  // AIレビューをパース（ローカライズ対応）
  const aiReview = getLocalizedAiReview(performer.aiReview, locale);

  // バイオをローカライズ
  const bio = getLocalizedPerformerBio(performer, locale);

  return {
    id: String(performer.id),
    name: getLocalizedPerformerName(performer, locale),
    catchcopy: '',
    description: bio,
    heroImage: imageUrl,
    thumbnail: imageUrl,
    primaryGenres: ['premium'],
    services: providerIds,
    metrics: {
      releaseCount,
      trendingScore: 0,
      fanScore: 0,
    },
    highlightWorks: [],
    tags: [],
    aliases: aliases && aliases.length > 0 ? aliases : undefined,
    aiReview,
    aiReviewUpdatedAt: performer.aiReviewUpdatedAt?.toISOString(),
  };
}

/**
 * データベースの出演者(performer)をActress型に変換（非同期版 - 単一取得用）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
async function mapPerformerToActressType(performer: DbPerformer, locale: string = 'ja'): Promise<ActressType> {
  const db = getDb();

  // 作品数、サムネイル、ASPサービスを並列取得
  const [productCountResult, thumbnailResult, servicesResult] = await Promise.all([
    // 作品数
    db.select({ count: sql<number>`count(*)` })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performer.id)),
    // サムネイル（DTI以外の商品を優先、なければDTIから取得）
    db.select({ thumbnailUrl: products.defaultThumbnailUrl, aspName: productSources.aspName })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(
        and(
          eq(productPerformers.performerId, performer.id),
          sql`${products.defaultThumbnailUrl} IS NOT NULL`,
          sql`${products.defaultThumbnailUrl} != ''`
        )
      )
      .orderBy(
        sql`CASE WHEN ${productSources.aspName} != 'DTI' THEN 0 ELSE 1 END`,
        desc(products.createdAt)
      )
      .limit(1),
    // ASPサービス一覧（DTIは個別サービスに分割）
    db.execute<{ asp_name: string }>(sql`
      SELECT DISTINCT
        ${sql.raw(buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url'))} as asp_name
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      INNER JOIN products p ON pp.product_id = p.id
      WHERE pp.performer_id = ${performer.id}
      AND ps.asp_name IS NOT NULL
    `),
  ]);

  const releaseCount = productCountResult[0]?.count || 0;
  const thumbnailUrl = thumbnailResult[0]?.thumbnailUrl;
  const services = (servicesResult.rows as { asp_name: string }[])
    .map(r => r.asp_name)
    .filter((s): s is string => s !== null && s !== '');

  return mapPerformerToActressTypeSync(performer, Number(releaseCount), thumbnailUrl ?? undefined, services, undefined, locale);
}

/**
 * 商品をあいまい検索（メーカー品番、タイトル、normalizedProductIdで検索）
 * 複数の商品が見つかる可能性があります
 */
export async function fuzzySearchProducts(query: string, limit: number = 20): Promise<ProductType[]> {
  try {
    const db = getDb();
    const searchPattern = `%${query}%`;

    // product_sourcesテーブルでoriginal_product_idを検索
    const sourceMatches = await db
      .select({ productId: productSources.productId })
      .from(productSources)
      .where(sql`${productSources.originalProductId} ILIKE ${searchPattern}`)
      .limit(limit);

    // productsテーブルでnormalized_product_idとtitleを検索
    const productMatches = await db
      .select({ id: products.id })
      .from(products)
      .where(
        or(
          sql`${products.normalizedProductId} ILIKE ${searchPattern}`,
          sql`${products.title} ILIKE ${searchPattern}`
        )!
      )
      .limit(limit);

    // 重複を排除してproduct IDsを集める
    const productIds = new Set<string>();
    sourceMatches.forEach(m => productIds.add(m.productId.toString()));
    productMatches.forEach(m => productIds.add(m.id.toString()));

    if (productIds.size === 0) {
      return [];
    }

    // 各商品の詳細情報を取得
    const productDetails = await Promise.all(
      Array.from(productIds).slice(0, limit).map(id => getProductById(id))
    );

    return productDetails.filter((p): p is ProductType => p !== null);
  } catch (error) {
    console.error('Error in fuzzy search:', error);
    throw error;
  }
}

/**
 * 新作が出た女優を取得（最近リリースされた商品に出演している女優）
 */
export async function getActressesWithNewReleases(options: {
  limit?: number;
  daysAgo?: number; // 何日前までの新作を対象とするか（デフォルト: 30日）
  locale?: string;
} = {}) {
  const { limit = 20, daysAgo = 30, locale = 'ja' } = options;

  try {
    const db = getDb();

    // 指定期間内にリリースされた商品を取得し、その出演者をユニークに取得
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - daysAgo);
    // release_dateはtext型（YYYY-MM-DD形式）なので、同じ形式で比較
    const recentDateStr = recentDate.toISOString().split('T')[0];

    // Use raw SQL query to avoid Drizzle ORM issues with aggregation
    // release_dateはDATE型なので、::dateでキャストして比較
    const result = await db.execute<{
      id: number;
      name: string;
      name_kana: string | null;
      latest_release_date: string;
      product_count: string;
    }>(sql`
      SELECT
        p.id,
        p.name,
        p.name_kana,
        MAX(pr.release_date)::text as latest_release_date,
        COUNT(DISTINCT pr.id)::text as product_count
      FROM performers p
      INNER JOIN product_performers pp ON p.id = pp.performer_id
      INNER JOIN products pr ON pp.product_id = pr.id
      WHERE pr.release_date >= ${recentDateStr}::date
      GROUP BY p.id, p.name, p.name_kana
      ORDER BY MAX(pr.release_date) DESC
      LIMIT ${limit}
    `);

    // Check if result.rows exists and is an array
    if (!result || !result.rows || !Array.isArray(result.rows)) {
      console.warn('getActressesWithNewReleases: No rows returned from query');
      return [];
    }

    // ActressType形式に変換（getActressByIdで画像など取得）
    const actressesWithDetails = await Promise.all(
      result.rows.map(async (actress) => {
        const fullActress = await getActressById(actress.id.toString(), locale);
        return fullActress || {
          id: actress.id.toString(),
          name: actress.name,
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
        } as ActressType;
      })
    );

    return actressesWithDetails;
  } catch (error) {
    console.error('Error getting actresses with new releases:', error);
    throw error;
  }
}

/**
 * 人気タグ(作品数が多いタグ)を取得
 */
export async function getPopularTags(options: {
  category?: string;
  limit?: number;
} = {}): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  try {
    const { category, limit = 20 } = options;
    const db = getDb();

    // タグとその作品数を取得（タイムアウト対策: シンプルなクエリに変更）
    // product_tagsのJOINは重いので、tagsテーブルのみ取得してcountは0で返す
    // 本番環境では定期的にキャッシュを更新するか、別途集計テーブルを用意
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(category ? eq(tags.category, category) : undefined)
      .orderBy(tags.name)
      .limit(limit);

    return result.map(tag => ({ ...tag, count: 0 }));
  } catch (error) {
    console.error('Error getting popular tags:', error);
    // タイムアウトエラーの場合は空配列を返す
    return [];
  }
}

/**
 * 最新の商品を取得（RSS用）
 * @param options.locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getRecentProducts(options?: {
  limit?: number;
  locale?: string;
}): Promise<ProductType[]> {
  try {
    const db = getDb();
    const limit = options?.limit || 100;
    const locale = options?.locale || 'ja';

    // 最新の商品を取得
    const results = await db
      .select()
      .from(products)
      .orderBy(desc(products.releaseDate), desc(products.createdAt))
      .limit(limit);

    // 関連データを並列で取得
    const productsWithData = await Promise.all(
      results.map(async (product) => {
        const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

        return mapProductToType(
          product,
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

    return productsWithData;
  } catch (error) {
    console.error('Error getting recent products:', error);
    throw error;
  }
}

/**
 * 出演者なし作品（未整理作品）を取得
 */
export async function getUncategorizedProducts(options?: {
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
}): Promise<ProductType[]> {
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

    // 品番パターンフィルター条件
    let patternCondition = sql`TRUE`;
    if (pattern === 'SIRO') {
      patternCondition = sql`p.normalized_product_id LIKE 'SIRO-%'`;
    } else if (pattern === '200GANA') {
      patternCondition = sql`p.normalized_product_id LIKE '200GANA-%'`;
    } else if (pattern === 'LUXU') {
      patternCondition = sql`p.normalized_product_id LIKE 'LUXU-%'`;
    } else if (pattern === 'HEYZO') {
      patternCondition = sql`p.normalized_product_id LIKE 'HEYZO-%'`;
    } else if (pattern === 'DTI') {
      patternCondition = sql`p.normalized_product_id ~ '^[0-9]{6}_[0-9]{3}$'`;
    } else if (pattern === 'DVD') {
      patternCondition = sql`p.normalized_product_id ~ '^[A-Z]+-[0-9]+$'`;
    } else if (pattern === 'OTHER') {
      patternCondition = sql`
        p.normalized_product_id NOT LIKE 'SIRO-%'
        AND p.normalized_product_id NOT LIKE '200GANA-%'
        AND p.normalized_product_id NOT LIKE 'LUXU-%'
        AND p.normalized_product_id NOT LIKE 'HEYZO-%'
        AND p.normalized_product_id !~ '^[0-9]{6}_[0-9]{3}$'
        AND p.normalized_product_id !~ '^[A-Z]+-[0-9]+$'
      `;
    }

    // 頭文字フィルター条件
    let initialCondition = sql`TRUE`;
    if (initial) {
      if (initial === 'etc') {
        initialCondition = sql`
          p.title !~ '^[あ-んア-ンa-zA-Z]'
        `;
      } else if (/^[A-Za-z]$/.test(initial)) {
        initialCondition = sql`UPPER(LEFT(p.title, 1)) = ${initial.toUpperCase()}`;
      } else {
        initialCondition = sql`LEFT(p.title, 1) = ${initial}`;
      }
    }

    // ASPフィルター条件（対象/除外）
    // DTIサブサービス（caribbeancom, 1pondo等）に対応するためCASE式を使用
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    let aspCondition = sql`TRUE`;
    if (includeAsp.length > 0) {
      aspCondition = sql`(${sql.raw(aspNormalizeSql)}) IN (${sql.join(includeAsp.map(a => sql`${a}`), sql`, `)})`;
    }
    let excludeAspCondition = sql`TRUE`;
    if (excludeAsp.length > 0) {
      excludeAspCondition = sql`(ps.asp_name IS NULL OR (${sql.raw(aspNormalizeSql)}) NOT IN (${sql.join(excludeAsp.map(a => sql`${a}`), sql`, `)}))`;
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

    // ソート条件
    let orderByClause;
    switch (sortBy) {
      case 'releaseDateAsc':
        orderByClause = sql`p.release_date ASC NULLS LAST, p.created_at ASC`;
        break;
      case 'priceAsc':
        orderByClause = sql`ps.price ASC NULLS LAST, p.release_date DESC NULLS LAST`;
        break;
      case 'priceDesc':
        orderByClause = sql`ps.price DESC NULLS LAST, p.release_date DESC NULLS LAST`;
        break;
      case 'titleAsc':
        orderByClause = sql`p.title ASC`;
        break;
      default:
        orderByClause = sql`p.release_date DESC NULLS LAST, p.created_at DESC`;
    }

    // 出演者がいない商品を取得
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
        const { tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, product.id);

        // ローカライズ適用
        const localizedTitle = getLocalizedTitle({
          title: product.title || '',
          titleEn: product.title_en,
          titleZh: product.title_zh,
          titleZhTw: product.title_zh_tw,
          titleKo: product.title_ko,
        }, locale);
        const localizedDescription = getLocalizedDescription({
          description: product.description,
          descriptionEn: product.description_en,
          descriptionZh: product.description_zh,
          descriptionZhTw: product.description_zh_tw,
          descriptionKo: product.description_ko,
        }, locale);

        return {
          id: String(product.id),
          title: localizedTitle,
          description: localizedDescription,
          normalizedProductId: product.normalized_product_id,
          imageUrl: product.default_thumbnail_url || '',
          releaseDate: product.release_date,
          duration: product.duration,
          price: sourceData?.price || 0,
          category: 'all' as const,
          affiliateUrl: sourceData?.affiliateUrl || '',
          provider: (sourceData?.aspName?.toLowerCase() || 'duga') as ProviderId,
          providerLabel: sourceData?.aspName || '',
          performers: [],
          tags: tagData.map(t => getLocalizedTagName(t, locale)),
          sampleImages: imagesData.map(img => img.imageUrl),
          sampleVideos: videosData.map(v => ({
            url: v.videoUrl,
            type: v.videoType || 'streaming',
            quality: v.quality || undefined,
            duration: v.duration || undefined,
          })),
        } as ProductType;
      })
    );

    return productsWithData;
  } catch (error) {
    console.error('Error getting uncategorized products:', error);
    throw error;
  }
}

/**
 * 出演者なし作品（未整理作品）の数を取得
 * 注: FANZAサイトではFANZA商品のみを表示（規約により他ASP商品は表示禁止）
 */
export async function getUncategorizedProductsCount(options?: {
  pattern?: string;
  initial?: string;
  includeAsp?: string[];
  excludeAsp?: string[];
  hasVideo?: boolean;
  hasImage?: boolean;
}): Promise<number> {
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
      const cached = getFromMemoryCache<number>('uncategorizedCount:fanza:base');
      if (cached !== null) return cached;
    }

    // 品番パターンフィルター条件
    let patternCondition = sql`TRUE`;
    if (pattern === 'SIRO') {
      patternCondition = sql`p.normalized_product_id LIKE 'SIRO-%'`;
    } else if (pattern === '200GANA') {
      patternCondition = sql`p.normalized_product_id LIKE '200GANA-%'`;
    } else if (pattern === 'LUXU') {
      patternCondition = sql`p.normalized_product_id LIKE 'LUXU-%'`;
    } else if (pattern === 'HEYZO') {
      patternCondition = sql`p.normalized_product_id LIKE 'HEYZO-%'`;
    } else if (pattern === 'DTI') {
      patternCondition = sql`p.normalized_product_id ~ '^[0-9]{6}_[0-9]{3}$'`;
    } else if (pattern === 'DVD') {
      patternCondition = sql`p.normalized_product_id ~ '^[A-Z]+-[0-9]+$'`;
    } else if (pattern === 'OTHER') {
      patternCondition = sql`
        p.normalized_product_id NOT LIKE 'SIRO-%'
        AND p.normalized_product_id NOT LIKE '200GANA-%'
        AND p.normalized_product_id NOT LIKE 'LUXU-%'
        AND p.normalized_product_id NOT LIKE 'HEYZO-%'
        AND p.normalized_product_id !~ '^[0-9]{6}_[0-9]{3}$'
        AND p.normalized_product_id !~ '^[A-Z]+-[0-9]+$'
      `;
    }

    // 頭文字フィルター条件
    let initialCondition = sql`TRUE`;
    if (initial) {
      if (initial === 'etc') {
        initialCondition = sql`
          p.title !~ '^[あ-んア-ンa-zA-Z]'
        `;
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
      AND EXISTS (
        SELECT 1 FROM product_sources ps_fanza
        WHERE ps_fanza.product_id = p.id
        AND ps_fanza.asp_name = 'FANZA'
      )
    `;

    const result = await db.execute(query);
    const count = Number((result.rows[0] as { count: string | number }).count);

    // フィルタなしの場合はキャッシュに保存
    if (!hasFilters) {
      setToMemoryCache('uncategorizedCount:fanza:base', count);
    }

    return count;
  } catch (error) {
    console.error('Error getting uncategorized products count:', error);
    throw error;
  }
}

/**
 * マルチASP女優を取得（複数のサイトに出演している女優）
 * コンセプト: アフィリエイトサイトを横断して作品を探す
 */
export async function getMultiAspActresses(options: {
  limit?: number;
  minAspCount?: number; // 最低何サイト以上に出演しているか
} = {}): Promise<ActressType[]> {
  const { limit = 20, minAspCount = 2 } = options;

  try {
    const db = getDb();

    // 複数ASPに商品がある女優を取得
    const result = await db.execute<{
      performer_id: number;
      asp_count: string;
      total_products: string;
    }>(sql`
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
      SELECT performer_id, asp_count, total_products
      FROM performer_asp_stats
      ORDER BY asp_count DESC, total_products DESC
      LIMIT ${limit}
    `);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    // ActressType形式に変換
    const actresses = await Promise.all(
      result.rows.map(async (row) => {
        const fullActress = await getActressById(row.performer_id.toString());
        return fullActress;
      })
    );

    return actresses.filter((a): a is ActressType => a !== null);
  } catch (error) {
    console.error('Error getting multi-ASP actresses:', error);
    return [];
  }
}

/**
 * ASP別人気女優を取得
 */
export async function getActressesByAsp(options: {
  aspName: string;
  limit?: number;
} = { aspName: 'DUGA' }): Promise<ActressType[]> {
  const { aspName, limit = 10 } = options;

  try {
    const db = getDb();

    // 指定ASPで作品数が多い女優を取得
    const result = await db.execute<{
      performer_id: number;
      product_count: string;
    }>(sql`
      SELECT
        pp.performer_id,
        COUNT(DISTINCT pp.product_id) as product_count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE ps.asp_name = ${aspName}
      GROUP BY pp.performer_id
      ORDER BY COUNT(DISTINCT pp.product_id) DESC
      LIMIT ${limit}
    `);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    // ActressType形式に変換
    const actresses = await Promise.all(
      result.rows.map(async (row) => {
        const fullActress = await getActressById(row.performer_id.toString());
        return fullActress;
      })
    );

    return actresses.filter((a): a is ActressType => a !== null);
  } catch (error) {
    console.error(`Error getting actresses for ASP ${aspName}:`, error);
    return [];
  }
}

/**
 * プロバイダー（ASP）別商品数を取得（フィルター表示用）
 * providerMeta のIDをキーとした件数を返す
 */
export async function getProviderProductCounts(): Promise<Record<string, number>> {
  try {
    const db = getDb();

    const result = await db.execute<{
      asp_name: string;
      count: string;
    }>(sql`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as count
      FROM product_sources ps
      WHERE ps.asp_name IS NOT NULL
      GROUP BY ps.asp_name
    `);

    if (!result.rows) return {};

    // ASP名からproviderIdへのマッピング
    const aspToProviderId: Record<string, string> = {
      'DUGA': 'duga',
      'APEX': 'duga',
      'DTI': 'dti',
      'DMM': 'dmm',
      'MGS': 'mgs',
      'SOKMIL': 'sokmil',
      'Sokmil': 'sokmil',
      'B10F': 'b10f',
      'b10f': 'b10f',
      'FC2': 'fc2',
      'Japanska': 'japanska',
      'JAPANSKA': 'japanska',
    };

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      const providerId = aspToProviderId[row.asp_name];
      if (providerId) {
        // 同じproviderIdに対して複数のASP名がある場合は合算
        counts[providerId] = (counts[providerId] || 0) + parseInt(row.count, 10);
      }
    }

    return counts;
  } catch (error) {
    console.error('Error getting provider product counts:', error);
    return {};
  }
}

/**
 * ASP別商品数統計を取得 - 内部実装
 * DTIも含めて全ASPの統計を返す（UIレベルでフィルタリング可能）
 */
async function getAspStatsInternal(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
  const db = getDb();

  // DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得
  // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
  const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
  const result = await db.execute<{
    asp_name: string;
    product_count: string;
    actress_count: string;
  }>(sql`
    SELECT
      ${sql.raw(aspNormalizeSql)} as asp_name,
      COUNT(DISTINCT ps.product_id) as product_count,
      COUNT(DISTINCT pp.performer_id) as actress_count
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name IS NOT NULL
    GROUP BY ${sql.raw(aspNormalizeSql)}
    ORDER BY product_count DESC
  `);

  if (!result.rows) return [];

  // 同じ正規化名のエントリを統合（normalizeAspName関数を使用）
  const merged = new Map<string, { productCount: number; actressCount: number }>();
  for (const row of result.rows) {
    const normalized = normalizeAspName(row.asp_name);
    const existing = merged.get(normalized);
    if (existing) {
      existing.productCount += parseInt(row.product_count, 10);
      existing.actressCount += parseInt(row.actress_count, 10);
    } else {
      merged.set(normalized, {
        productCount: parseInt(row.product_count, 10),
        actressCount: parseInt(row.actress_count, 10),
      });
    }
  }

  return Array.from(merged.entries()).map(([aspName, stats]) => ({
    aspName,
    productCount: stats.productCount,
    actressCount: stats.actressCount,
  }));
}

/**
 * ASP別商品数統計を取得 - unstable_cacheでインスタンス間キャッシュ
 */
const getCachedAspStats = createCachedFunction(
  async () => {
    try {
      return await getAspStatsInternal();
    } catch (error) {
      console.error('Error getting ASP stats:', error);
      return [];
    }
  },
  ['aspStats-fanza'],
  ['asp-stats'],
  CACHE_REVALIDATE_SECONDS
);

export async function getAspStats(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
  return getCachedAspStats();
}

/**
 * ジャンル/カテゴリ一覧を取得（商品数付き）
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

export async function getCategories(options?: {
  category?: string;
  sortBy?: 'productCount' | 'name';
  limit?: number;
}): Promise<CategoryWithCount[]> {
  try {
    const db = getDb();
    const categoryFilter = options?.category || 'genre';
    const sortBy = options?.sortBy || 'productCount';
    const limit = options?.limit || 100;

    const result = await db.execute<{
      id: number;
      name: string;
      name_en: string | null;
      name_zh: string | null;
      name_ko: string | null;
      category: string | null;
      product_count: string;
    }>(sql`
      SELECT
        t.id,
        t.name,
        t.name_en,
        t.name_zh,
        t.name_ko,
        t.category,
        COUNT(pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.category = ${categoryFilter}
      GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
      HAVING COUNT(pt.product_id) > 0
      ORDER BY ${sortBy === 'name' ? sql`t.name ASC` : sql`COUNT(pt.product_id) DESC`}
      LIMIT ${limit}
    `);

    if (!result.rows) return [];

    return result.rows.map(row => ({
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
 * 特定カテゴリの商品一覧を取得
 */
export async function getProductsByCategory(
  tagId: number,
  options?: {
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
): Promise<ProductType[]> {
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
    const rows = results.rows as unknown as RawProductRow[];
    const productIds = rows.map(r => r.id);
    if (productIds.length === 0) return [];

    const fullProducts = await Promise.all(
      productIds.map(async (productId) => {
        const { performerData, tagData, sourceData, imagesData, videosData } = await fetchProductRelatedData(db, productId);
        const baseProduct = rows.find(r => r.id === productId)!;
        return mapProductToType(
          {
            id: baseProduct.id,
            normalizedProductId: baseProduct.normalized_product_id || '',
            makerProductCode: baseProduct.maker_product_code ?? null,
            title: baseProduct.title || '',
            releaseDate: baseProduct.release_date?.toISOString().split('T')[0] ?? null,
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

    return fullProducts;
  } catch (error) {
    console.error('Error getting products by category:', error);
    return [];
  }
}

/**
 * カテゴリ別の商品数を取得
 */
export async function getProductCountByCategory(
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

    const result = await db.execute<{ count: string }>(sql`
      SELECT COUNT(DISTINCT p.id) as count
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
    `);
    return parseInt(result.rows?.[0]?.count || '0', 10);
  } catch (error) {
    console.error('Error getting product count by category:', error);
    return 0;
  }
}

/**
 * カテゴリ別のASP統計を取得
 */
export async function getAspStatsByCategory(
  tagId: number
): Promise<Array<{ aspName: string; count: number }>> {
  try {
    const db = getDb();
    // DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得
    // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    const result = await db.execute<{ asp_name: string; count: string }>(sql`
      SELECT
        ${sql.raw(aspNormalizeSql)} as asp_name,
        COUNT(DISTINCT p.id) as count
      FROM products p
      INNER JOIN product_tags pt ON p.id = pt.product_id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE pt.tag_id = ${tagId}
      AND ps.asp_name IS NOT NULL
      GROUP BY ${sql.raw(aspNormalizeSql)}
      ORDER BY COUNT(DISTINCT p.id) DESC
    `);

    return result.rows.map((row) => ({
      aspName: row.asp_name,
      count: parseInt(row.count, 10),
    }));
  } catch (error) {
    console.error('Error getting ASP stats by category:', error);
    return [];
  }
}

/**
 * タグをIDで取得
 */
export async function getTagById(tagId: number): Promise<{
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  category: string | null;
} | null> {
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      name: result[0].name,
      nameEn: result[0].nameEn,
      nameZh: result[0].nameZh,
      nameKo: result[0].nameKo,
      category: result[0].category,
    };
  } catch (error) {
    console.error('Error getting tag by id:', error);
    return null;
  }
}

/**
 * 未整理作品のASP別・品番パターン別統計
 */
export interface UncategorizedStats {
  aspStats: Array<{ aspName: string; count: number }>;
  patternStats: Array<{ pattern: string; label: string; count: number }>;
  totalCount: number;
}

export async function getUncategorizedStats(): Promise<UncategorizedStats> {
  try {
    const db = getDb();

    // ASP別統計（DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得）
    // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    const aspResult = await db.execute<{ asp_name: string; count: string }>(sql`
      SELECT
        ${sql.raw(aspNormalizeSql)} as asp_name,
        COUNT(DISTINCT p.id) as count
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      LEFT JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.product_id IS NULL AND ps.asp_name IS NOT NULL
      GROUP BY ${sql.raw(aspNormalizeSql)}
      ORDER BY count DESC
    `);

    // 品番パターン別統計
    const patternResult = await db.execute<{ pattern: string; count: string }>(sql`
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
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      WHERE pp.product_id IS NULL
      GROUP BY pattern
      ORDER BY count DESC
    `);

    // 総数
    const totalResult = await db.execute<{ count: string }>(sql`
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
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

    return {
      aspStats: aspResult.rows?.map(row => ({
        aspName: row.asp_name,
        count: parseInt(row.count, 10),
      })) || [],
      patternStats: patternResult.rows?.map(row => ({
        pattern: row.pattern,
        label: patternLabels[row.pattern] || row.pattern,
        count: parseInt(row.count, 10),
      })) || [],
      totalCount: parseInt(totalResult.rows?.[0]?.count || '0', 10),
    };
  } catch (error) {
    console.error('Error getting uncategorized stats:', error);
    return { aspStats: [], patternStats: [], totalCount: 0 };
  }
}

/**
 * wiki_crawl_dataから商品コードに対応する候補演者を取得
 */
export async function getCandidatePerformers(productCode: string): Promise<Array<{
  name: string;
  source: string;
}>> {
  try {
    const db = getDb();

    const result = await db.execute<{ performer_name: string; source: string }>(sql`
      SELECT DISTINCT performer_name, source
      FROM wiki_crawl_data
      WHERE product_code = ${productCode}
      LIMIT 10
    `);

    return result.rows?.map(row => ({
      name: row.performer_name,
      source: row.source,
    })) || [];
  } catch (error) {
    console.error('Error getting candidate performers:', error);
    return [];
  }
}

// SaleProduct型をre-export（後方互換性維持）
export type { SaleProduct };

/**
 * セール情報付き商品を取得
 */
export async function getSaleProducts(options?: {
  limit?: number;
  aspName?: string;
  minDiscount?: number;
}): Promise<SaleProduct[]> {
  try {
    const db = getDb();
    const limit = options?.limit || 20;

    // キャッシュキー生成
    const cacheKey = `saleProducts:fanza:${limit}:${options?.aspName || ''}:${options?.minDiscount || 0}`;
    const cached = getFromMemoryCache<SaleProduct[]>(cacheKey);
    if (cached) return cached;

    const conditions = [
      eq(productSales.isActive, true),
      sql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`,
    ];

    if (options?.aspName) {
      conditions.push(eq(productSources.aspName, options.aspName));
    }

    if (options?.minDiscount) {
      conditions.push(gte(productSales.discountPercent, options.minDiscount));
    }

    const results = await db
      .select({
        productId: products.id,
        normalizedProductId: products.normalizedProductId,
        title: products.title,
        thumbnailUrl: products.defaultThumbnailUrl,
        aspName: productSources.aspName,
        affiliateUrl: productSources.affiliateUrl,
        regularPrice: productSales.regularPrice,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
        saleName: productSales.saleName,
        saleType: productSales.saleType,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
      .innerJoin(products, eq(productSources.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(productSales.discountPercent), desc(productSales.fetchedAt))
      .limit(limit);

    // 出演者情報を取得
    const productIds = results.map(r => r.productId);
    const performerData = productIds.length > 0
      ? await db
          .select({
            productId: productPerformers.productId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(productPerformers)
          .innerJoin(performers, eq(productPerformers.performerId, performers.id))
          .where(inArray(productPerformers.productId, productIds))
      : [];

    // 商品IDごとに出演者をグループ化
    const performersByProduct = new Map<number, Array<{ id: number; name: string }>>();
    for (const p of performerData) {
      const arr = performersByProduct.get(p.productId) || [];
      arr.push({ id: p.performerId, name: p.performerName });
      performersByProduct.set(p.productId, arr);
    }

    const saleProducts = results.map(r => ({
      productId: r.productId,
      normalizedProductId: r.normalizedProductId,
      title: r.title,
      thumbnailUrl: r.thumbnailUrl,
      aspName: r.aspName,
      affiliateUrl: r.affiliateUrl,
      regularPrice: r.regularPrice,
      salePrice: r.salePrice,
      discountPercent: r.discountPercent || 0,
      saleName: r.saleName,
      saleType: r.saleType,
      endAt: r.endAt,
      performers: performersByProduct.get(r.productId) || [],
    }));

    // キャッシュに保存
    setToMemoryCache(cacheKey, saleProducts);
    return saleProducts;
  } catch (error) {
    console.error('Error fetching sale products:', error);
    return [];
  }
}

/**
 * セール情報の統計を取得
 * @param aspName オプション。指定された場合、そのASPのセールのみをカウント
 * 注: FANZAサイトではFANZA商品のみを表示（規約により他ASP商品は表示禁止）
 */
export async function getSaleStats(aspName?: string): Promise<{
  totalSales: number;
  byAsp: Array<{ aspName: string; count: number; avgDiscount: number }>;
}> {
  try {
    const db = getDb();

    // 基本条件
    const baseConditions = [
      eq(productSales.isActive, true),
      sql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`
    ];

    // アクティブなセール総数（ASPフィルター適用）
    let totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(productSales);

    if (aspName) {
      // ASPフィルターがある場合はJOINして絞り込む
      totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(productSales)
        .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
        .where(and(
          ...baseConditions,
          eq(productSources.aspName, aspName)
        )) as unknown as typeof totalQuery;
    } else {
      totalQuery = totalQuery.where(and(...baseConditions)) as unknown as typeof totalQuery;
    }

    const totalResult = await totalQuery;
    const total = Number(totalResult[0]?.count || 0);

    // ASP別統計（ASPフィルターがある場合はそのASPのみ）
    let byAspQuery = db
      .select({
        aspName: productSources.aspName,
        count: sql<number>`count(*)`,
        avgDiscount: sql<number>`avg(${productSales.discountPercent})`,
      })
      .from(productSales)
      .innerJoin(productSources, eq(productSales.productSourceId, productSources.id));

    if (aspName) {
      byAspQuery = byAspQuery.where(and(
        ...baseConditions,
        eq(productSources.aspName, aspName)
      )) as typeof byAspQuery;
    } else {
      byAspQuery = byAspQuery.where(and(...baseConditions)) as typeof byAspQuery;
    }

    const byAspResult = await byAspQuery
      .groupBy(productSources.aspName)
      .orderBy(desc(sql`count(*)`));

    return {
      totalSales: total,
      byAsp: byAspResult.map(r => ({
        aspName: r.aspName,
        count: Number(r.count),
        avgDiscount: Math.round(Number(r.avgDiscount) || 0),
      })),
    };
  } catch (error) {
    console.error('Error fetching sale stats:', error);
    return { totalSales: 0, byAsp: [] };
  }
}

/**
 * 女優のキャリア分析データを取得
 * 年別の作品数、デビュー作、最新作、全盛期などを分析
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

export async function getActressCareerAnalysis(actressId: string): Promise<CareerAnalysis | null> {
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

    const yearlyStats = yearlyResult.rows.map((row: Record<string, unknown>) => ({
      year: row.year as number,
      count: row.count as number,
      products: (row.products as Array<{ id: number; title: string; releaseDate: string }>).slice(0, 5), // 各年最大5件
    }));

    // 全盛期（最も作品数が多い年）
    const peakYearData = yearlyStats.reduce((max, curr) =>
      curr.count > max.count ? curr : max, yearlyStats[0]);

    // デビュー作と最新作
    const firstYear = yearlyStats[0];
    const lastYear = yearlyStats[yearlyStats.length - 1];
    const debutProduct = firstYear?.products[0] || null;
    const latestProduct = lastYear?.products[lastYear.products.length - 1] || null;

    // 総作品数
    const totalProducts = yearlyStats.reduce((sum, y) => sum + y.count, 0);

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
    console.error(`Error fetching career analysis for actress ${actressId}:`, error);
    return null;
  }
}

/**
 * シリーズ内の作品の型定義
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
 * シリーズ情報を取得（シリーズ完走ガイド用）
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

export async function getSeriesInfo(seriesTagId: number): Promise<SeriesInfo | null> {
  try {
    const db = getDb();

    const tagResult = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, seriesTagId), eq(tags.category, 'series')))
      .limit(1);

    if (tagResult.length === 0) return null;

    const tag = tagResult[0];

    const statsResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT p.id)::int as total_products,
        COALESCE(SUM(p.duration), 0)::int as total_duration,
        MIN(p.release_date) as first_release,
        MAX(p.release_date) as last_release,
        AVG(rs.average_rating)::numeric(3,2) as avg_rating
      FROM products p
      JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN product_rating_summary rs ON p.id = rs.product_id
      WHERE pt.tag_id = ${seriesTagId}
    `);

    const stats = statsResult.rows?.[0] as Record<string, unknown> || {};

    const performersResult = await db.execute(sql`
      SELECT
        pf.id,
        pf.name,
        COUNT(*)::int as count
      FROM products p
      JOIN product_tags pt ON p.id = pt.product_id
      JOIN product_performers pp ON p.id = pp.product_id
      JOIN performers pf ON pp.performer_id = pf.id
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
 * シリーズ内の作品リストを取得
 */
export async function getSeriesProducts(
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
          FROM product_performers pp
          JOIN performers pf ON pp.performer_id = pf.id
          WHERE pp.product_id = p.id
        ) as performers,
        (
          SELECT MIN(ps.price)
          FROM product_sources ps
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
          FROM product_images pi
          WHERE pi.product_id = p.id AND pi.image_type = 'thumbnail'
          ORDER BY pi.display_order
          LIMIT 1
        ) as thumbnail_url,
        (
          SELECT EXISTS(
            SELECT 1 FROM product_videos pv WHERE pv.product_id = p.id
          )
        ) as has_video
      FROM products p
      JOIN product_tags pt ON p.id = pt.product_id
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

/**
 * 人気シリーズ一覧を取得
 */
export async function getPopularSeries(limit: number = 20): Promise<Array<{
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  productCount: number;
  latestReleaseDate: string | null;
}>> {
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
      FROM tags t
      JOIN product_tags pt ON t.id = pt.tag_id
      JOIN products p ON pt.product_id = p.id
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
export async function getPopularMakers(options?: {
  category?: 'maker' | 'label' | 'both';
  limit?: number;
  locale?: string;
}): Promise<Array<{
  id: number;
  name: string;
  category: 'maker' | 'label';
  productCount: number;
}>> {
  try {
    const { category = 'both', limit = 20, locale = 'ja' } = options || {};
    const db = getDb();

    const nameColumn = locale === 'en' ? sql`COALESCE(t.name_en, t.name)`
      : locale === 'zh' ? sql`COALESCE(t.name_zh, t.name)`
      : locale === 'ko' ? sql`COALESCE(t.name_ko, t.name)`
      : sql`t.name`;

    const categoryFilter = category === 'both'
      ? sql`t.category IN ('maker', 'label')`
      : sql`t.category = ${category}`;

    const result = await db.execute(sql`
      SELECT
        t.id,
        ${nameColumn} as name,
        t.category,
        COUNT(DISTINCT pt.product_id)::int as product_count
      FROM tags t
      JOIN product_tags pt ON t.id = pt.tag_id
      WHERE ${categoryFilter}
      GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
      ORDER BY product_count DESC
      LIMIT ${limit}
    `);

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      category: String(row.category) as 'maker' | 'label',
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
export async function analyzeMakerPreference(productIds: number[], locale: string = 'ja'): Promise<Array<{
  makerId: number;
  makerName: string;
  category: string;
  count: number;
  averageRating: number | null;
}>> {
  try {
    if (productIds.length === 0) return [];
    const db = getDb();

    const nameColumn = locale === 'en' ? sql`COALESCE(t.name_en, t.name)`
      : locale === 'zh' ? sql`COALESCE(t.name_zh, t.name)`
      : locale === 'ko' ? sql`COALESCE(t.name_ko, t.name)`
      : sql`t.name`;

    const result = await db.execute<{
      maker_id: number;
      maker_name: string;
      category: string;
      count: string;
      avg_rating: string | null;
    }>(sql`
      SELECT
        t.id as maker_id,
        ${nameColumn} as maker_name,
        t.category,
        COUNT(pt.product_id)::text as count,
        AVG(prs.average_rating)::text as avg_rating
      FROM product_tags pt
      JOIN tags t ON pt.tag_id = t.id
      LEFT JOIN product_rating_summary prs ON pt.product_id = prs.product_id
      WHERE pt.product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
        AND t.category IN ('maker', 'label')
      GROUP BY t.id, t.name, t.name_en, t.name_zh, t.name_ko, t.category
      ORDER BY COUNT(pt.product_id) DESC
      LIMIT 10
    `);

    return (result.rows || []).map(row => ({
      makerId: row.maker_id,
      makerName: row.maker_name,
      category: row.category,
      count: parseInt(row.count, 10),
      averageRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
    }));
  } catch (error) {
    console.error('Error analyzing maker preference:', error);
    return [];
  }
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

export async function getMakerById(makerId: number, locale: string = 'ja'): Promise<MakerInfo | null> {
  try {
    const db = getDb();

    // タグ情報を取得（メーカーまたはレーベル）
    const tagResult = await db.execute<{
      id: number;
      name: string;
      name_en: string | null;
      name_zh: string | null;
      name_ko: string | null;
      category: string;
    }>(sql`
      SELECT id, name, name_en, name_zh, name_ko, category
      FROM tags
      WHERE id = ${makerId} AND category IN ('maker', 'label')
    `);

    if (!tagResult.rows || tagResult.rows.length === 0) {
      return null;
    }

    const tag = tagResult.rows[0];
    const makerName = locale === 'en' ? (tag.name_en || tag.name)
      : locale === 'zh' ? (tag.name_zh || tag.name)
      : locale === 'ko' ? (tag.name_ko || tag.name)
      : tag.name;

    // 作品数と平均評価を取得
    const statsResult = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      SELECT
        COUNT(DISTINCT pt.product_id)::text as count,
        AVG(prs.average_rating)::text as avg_rating
      FROM product_tags pt
      LEFT JOIN product_rating_summary prs ON pt.product_id = prs.product_id
      WHERE pt.tag_id = ${makerId}
    `);

    const productCount = parseInt(statsResult.rows?.[0]?.count || '0', 10);
    const averageRating = statsResult.rows?.[0]?.avg_rating
      ? parseFloat(statsResult.rows[0].avg_rating)
      : null;

    // 人気女優トップ5
    const performersResult = await db.execute<{
      performer_id: number;
      performer_name: string;
      product_count: string;
    }>(sql`
      SELECT
        perf.id as performer_id,
        perf.name as performer_name,
        COUNT(DISTINCT pt.product_id)::text as product_count
      FROM product_tags pt
      JOIN product_performers pp ON pt.product_id = pp.product_id
      JOIN performers perf ON pp.performer_id = perf.id
      WHERE pt.tag_id = ${makerId}
      GROUP BY perf.id, perf.name
      ORDER BY COUNT(DISTINCT pt.product_id) DESC
      LIMIT 5
    `);

    const topPerformers = (performersResult.rows || []).map(row => ({
      id: row.performer_id,
      name: row.performer_name,
      productCount: parseInt(row.product_count, 10),
    }));

    // 人気ジャンルトップ5
    const genresResult = await db.execute<{
      genre_id: number;
      genre_name: string;
      product_count: string;
    }>(sql`
      SELECT
        g.id as genre_id,
        COALESCE(
          ${locale === 'en' ? sql`g.name_en` : locale === 'zh' ? sql`g.name_zh` : locale === 'ko' ? sql`g.name_ko` : sql`g.name`},
          g.name
        ) as genre_name,
        COUNT(DISTINCT pt.product_id)::text as product_count
      FROM product_tags pt
      JOIN product_tags pt2 ON pt.product_id = pt2.product_id
      JOIN tags g ON pt2.tag_id = g.id AND g.category = 'genre'
      WHERE pt.tag_id = ${makerId}
      GROUP BY g.id, g.name, g.name_en, g.name_zh, g.name_ko
      ORDER BY COUNT(DISTINCT pt.product_id) DESC
      LIMIT 5
    `);

    const topGenres = (genresResult.rows || []).map(row => ({
      id: row.genre_id,
      name: row.genre_name,
      productCount: parseInt(row.product_count, 10),
    }));

    // 年別統計
    const yearlyResult = await db.execute<{ year: string; count: string }>(sql`
      SELECT
        EXTRACT(YEAR FROM p.release_date)::text as year,
        COUNT(DISTINCT pt.product_id)::text as count
      FROM product_tags pt
      JOIN products p ON pt.product_id = p.id
      WHERE pt.tag_id = ${makerId} AND p.release_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM p.release_date)
      ORDER BY year DESC
      LIMIT 10
    `);

    const yearlyStats = (yearlyResult.rows || []).map(row => ({
      year: parseInt(row.year, 10),
      count: parseInt(row.count, 10),
    }));

    // 最新作品5件
    const recentResult = await db.execute<{
      id: number;
      title: string;
      image_url: string | null;
      release_date: string | null;
    }>(sql`
      SELECT DISTINCT
        p.id,
        COALESCE(
          ${locale === 'en' ? sql`p.title_en` : locale === 'zh' ? sql`p.title_zh` : locale === 'ko' ? sql`p.title_ko` : sql`p.title`},
          p.title
        ) as title,
        p.default_thumbnail_url as image_url,
        p.release_date::text
      FROM products p
      JOIN product_tags pt ON p.id = pt.product_id
      WHERE pt.tag_id = ${makerId}
      ORDER BY p.release_date DESC NULLS LAST
      LIMIT 5
    `);

    const recentProducts = (recentResult.rows || []).map(row => ({
      id: row.id,
      title: row.title,
      imageUrl: row.image_url || '',
      releaseDate: row.release_date,
    }));

    return {
      id: makerId,
      name: makerName,
      category: tag.category as 'maker' | 'label',
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
 * 商品ソースとセール情報を取得
 */
export async function getProductSourcesWithSales(productId: number) {
  try {
    const db = getDb();

    // Get all sources for this product
    const sources = await db
      .select({
        id: productSources.id,
        aspName: productSources.aspName,
        originalProductId: productSources.originalProductId,
        price: productSources.price,
        currency: productSources.currency,
        affiliateUrl: productSources.affiliateUrl,
        isSubscription: productSources.isSubscription,
        productType: productSources.productType,
      })
      .from(productSources)
      .where(eq(productSources.productId, productId));

    if (sources.length === 0) {
      return [];
    }

    // Get sale info for these sources
    const sourceIds = sources.map(s => s.id);
    const sales = await db
      .select({
        productSourceId: productSales.productSourceId,
        regularPrice: productSales.regularPrice,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
        startAt: productSales.startAt,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .where(inArray(productSales.productSourceId, sourceIds));

    // Create a map for quick lookup
    const saleMap = new Map(sales.map(s => [s.productSourceId, s]));

    // Combine sources with sales
    return sources.map(source => ({
      ...source,
      sale: saleMap.get(source.id) || null,
    }));
  } catch (error) {
    console.error(`Error fetching product sources with sales for ${productId}:`, error);
    return [];
  }
}

/**
 * 女優の平均分単価を取得
 */
export async function getActressAvgPricePerMin(actressId: string): Promise<number | null> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return null;
    }

    const result = await db.execute<{ avg_price_per_min: string | null }>(sql`
      SELECT
        AVG(CASE WHEN p.duration > 0 AND ps.price > 0 THEN ps.price / p.duration ELSE NULL END) as avg_price_per_min
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${performerId}
      AND p.duration IS NOT NULL
      AND p.duration > 0
      AND ps.price IS NOT NULL
      AND ps.price > 0
    `);

    const avgPricePerMin = result.rows[0]?.avg_price_per_min;
    return avgPricePerMin ? parseFloat(avgPricePerMin) : null;
  } catch (error) {
    console.error(`Error fetching avg price per min for actress ${actressId}:`, error);
    return null;
  }
}

/**
 * seriesタイプのタグからシリーズを特定し、関連作品を取得
 */
export interface SeriesBasicInfo {
  id: number;
  name: string;
  totalProducts: number;
  totalDuration: number; // 総再生時間（分）
  products: Array<{
    id: number;
    title: string;
    imageUrl: string;
    releaseDate: string | null;
    duration: number | null;
    price: number | null;
  }>;
}

export async function getSeriesByTagId(tagId: number, locale: string = 'ja'): Promise<SeriesBasicInfo | null> {
  try {
    const db = getDb();

    // タグ情報を取得
    const tagResult = await db.execute(sql`
      SELECT id, name, name_en, name_zh, name_ko
      FROM tags
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
      FROM products p
      JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN LATERAL (
        SELECT price FROM product_sources
        WHERE product_id = p.id
        ORDER BY price NULLS LAST
        LIMIT 1
      ) ps ON true
      WHERE pt.tag_id = ${tagId}
      ORDER BY p.release_date NULLS LAST
    `);

    const products = (productsResult.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as number,
      title: row.title as string,
      imageUrl: row.image_url as string,
      releaseDate: row.release_date as string | null,
      duration: row.duration as number | null,
      price: row.price as number | null,
    }));

    const totalDuration = products.reduce((sum, p) => sum + (p.duration || 0), 0);

    return {
      id: tagId,
      name: tagName as string,
      totalProducts: products.length,
      totalDuration,
      products,
    };
  } catch (error) {
    console.error(`Error fetching series ${tagId}:`, error);
    return null;
  }
}

/**
 * 品番（maker_product_code）から全ASPのソース情報をセール情報付きで取得
 * 名寄せ用: 同じ品番を持つ異なるproduct_idの商品を統合
 */
export async function getProductSourcesByMakerCode(makerProductCode: string) {
  try {
    const db = getDb();

    // 同じ品番を持つ全商品のIDを取得
    const productIds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.makerProductCode, makerProductCode));

    if (productIds.length === 0) {
      return [];
    }

    const ids = productIds.map(p => p.id);

    // 全商品のソース情報を取得（FANZAのみ）
    const sources = await db
      .select({
        id: productSources.id,
        productId: productSources.productId,
        aspName: productSources.aspName,
        originalProductId: productSources.originalProductId,
        price: productSources.price,
        currency: productSources.currency,
        affiliateUrl: productSources.affiliateUrl,
        isSubscription: productSources.isSubscription,
        productType: productSources.productType,
      })
      .from(productSources)
      .where(and(
        inArray(productSources.productId, ids),
        sql`LOWER(${productSources.aspName}) = 'fanza'`
      ));

    if (sources.length === 0) {
      return [];
    }

    // セール情報を取得
    const sourceIds = sources.map(s => s.id);
    const sales = await db
      .select({
        productSourceId: productSales.productSourceId,
        regularPrice: productSales.regularPrice,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
        startAt: productSales.startAt,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .where(inArray(productSales.productSourceId, sourceIds));

    const saleMap = new Map(sales.map(s => [s.productSourceId, s]));

    // ASP名でユニーク化（同じASPが複数ある場合は最初の1つを使用）
    const uniqueByAsp = new Map<string, typeof sources[0] & { sale: typeof sales[0] | null }>();
    for (const source of sources) {
      if (!uniqueByAsp.has(source.aspName)) {
        uniqueByAsp.set(source.aspName, {
          ...source,
          sale: saleMap.get(source.id) || null,
        });
      }
    }

    return Array.from(uniqueByAsp.values());
  } catch (error) {
    console.error(`Error fetching product sources by maker code ${makerProductCode}:`, error);
    return [];
  }
}

/**
 * 品番（maker_product_code）から全ASPのサンプル画像を取得
 * 名寄せ用: 異なるASPのサンプル画像を統合して返す
 */
export async function getSampleImagesByMakerCode(makerProductCode: string) {
  try {
    const db = getDb();

    // 同じ品番を持つ全商品のサンプル画像を取得
    const result = await db.execute<{
      image_url: string;
      asp_name: string | null;
    }>(sql`
      SELECT DISTINCT pi.image_url, ps.asp_name
      FROM products p
      JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN product_sources ps ON p.id = ps.product_id
      WHERE p.maker_product_code = ${makerProductCode}
        AND pi.image_url IS NOT NULL
        AND pi.image_url != ''
      ORDER BY ps.asp_name NULLS LAST
    `);

    return result.rows.map(row => ({
      imageUrl: row.image_url,
      aspName: row.asp_name,
    }));
  } catch (error) {
    console.error(`Error fetching sample images by maker code ${makerProductCode}:`, error);
    return [];
  }
}

/**
 * 商品IDから品番（maker_product_code）を取得
 */
export async function getProductMakerCode(productId: number): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db
      .select({ makerProductCode: products.makerProductCode })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return result[0]?.makerProductCode || null;
  } catch (error) {
    console.error(`Error fetching maker code for product ${productId}:`, error);
    return null;
  }
}

