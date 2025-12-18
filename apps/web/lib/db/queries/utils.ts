/**
 * クエリ共通ユーティリティ
 * ヘルパー関数、型定義、キャッシュ関数
 */

import { getDb } from '../index';
import { products, performers, productPerformers, tags, productTags, productSources, productImages, productVideos, productSales } from '../schema';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType, ProductCategory, ProviderId } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider } from '@/lib/provider-utils';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { getLocalizedTitle, getLocalizedDescription, getLocalizedPerformerName, getLocalizedPerformerBio, getLocalizedTagName } from '@/lib/localization';

// ============================================================
// 型定義
// ============================================================

export type DbProduct = InferSelectModel<typeof products>;
export type DbPerformer = InferSelectModel<typeof performers>;

export type PerformerData = { id: number; name: string; nameKana: string | null };
export type TagData = { id: number; name: string; category: string | null };
export type ImageData = { productId: number; imageUrl: string; imageType: string; displayOrder: number | null };
export type VideoData = { productId: number; videoUrl: string; videoType: string | null; quality: string | null; duration: number | null };
export type SaleData = { productId: number; regularPrice: number; salePrice: number; discountPercent: number | null; endAt: Date | null };

export interface BatchRelatedDataResult {
  performersMap: Map<number, PerformerData[]>;
  tagsMap: Map<number, TagData[]>;
  sourcesMap: Map<number, typeof productSources.$inferSelect>;
  imagesMap: Map<number, ImageData[]>;
  videosMap: Map<number, VideoData[]>;
  salesMap: Map<number, SaleData>;
}

// ============================================================
// メモリ内キャッシュ（dev環境でのメモリリーク対策）
// ============================================================

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

export function getFromMemoryCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  memoryCache.delete(key);
  return null;
}

export function setToMemoryCache<T>(key: string, data: T): void {
  // キャッシュサイズ制限（100エントリまで）
  if (memoryCache.size > 100) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 無効な演者データをフィルタリングするヘルパー関数
 * クローリング時のパースエラーにより生成された無効なデータを除外
 */
export function isValidPerformer(performer: { name: string }): boolean {
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

/**
 * 女優名からIDを生成（プロバイダープレフィックスなし）
 */
export function generateActressId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================
// バッチ取得ヘルパー
// ============================================================

/**
 * 複数商品の関連データをバッチ取得するヘルパー関数
 * N+1問題を解消し、商品一覧の高速化に使用
 * @param preferredProviders - 優先プロバイダー（フィルター用）
 */
export async function batchFetchProductRelatedData(
  db: ReturnType<typeof getDb>,
  productIds: number[],
  preferredProviders?: string[]
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

  // 優先プロバイダーを考慮してソースを選択
  const sourcesMap = new Map<number, typeof allSources[0]>();
  const preferredProvidersUpper = preferredProviders?.map(p => p.toUpperCase()) || [];

  // まず各productIdごとにソースをグループ化
  const sourcesByProduct = new Map<number, typeof allSources>();
  for (const s of allSources) {
    if (!sourcesByProduct.has(s.productId)) sourcesByProduct.set(s.productId, []);
    sourcesByProduct.get(s.productId)!.push(s);
  }

  // 各商品で優先プロバイダーに一致するソースを選択
  // 重要: adult-vサイトではFANZAソースを絶対に使用しない（規約違反防止）
  let matchedCount = 0;
  let fallbackCount = 0;
  let skippedFanzaOnly = 0;
  for (const [productId, sources] of sourcesByProduct) {
    const nonFanzaSources = sources.filter(s => s.aspName.toUpperCase() !== 'FANZA');

    if (nonFanzaSources.length === 0) {
      skippedFanzaOnly++;
      continue;
    }

    if (preferredProvidersUpper.length > 0) {
      const preferredSource = nonFanzaSources.find(s =>
        preferredProvidersUpper.includes(s.aspName.toUpperCase())
      );
      if (preferredSource) {
        sourcesMap.set(productId, preferredSource);
        matchedCount++;
        continue;
      }
      fallbackCount++;
    }
    sourcesMap.set(productId, nonFanzaSources[0]);
  }

  if (preferredProvidersUpper.length > 0 || skippedFanzaOnly > 0) {
    console.log(`[batchFetch] Provider filter: ${preferredProvidersUpper.join(',') || 'none'} - matched: ${matchedCount}, fallback: ${fallbackCount}, skipped FANZA-only: ${skippedFanzaOnly}`);
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
    if (!salesMap.has(sale.productId)) {
      salesMap.set(sale.productId, sale);
    }
  }

  return { performersMap, tagsMap, sourcesMap, imagesMap, videosMap, salesMap };
}

/**
 * 商品の関連データ（出演者、タグ、ソース、画像、動画）を並列取得するヘルパー関数
 */
export async function fetchProductRelatedData(db: ReturnType<typeof getDb>, productId: number) {
  const [performerData, tagData, sourceData, imagesData, videosData] = await Promise.all([
    db
      .select({
        id: performers.id,
        name: performers.name,
        nameKana: performers.nameKana,
      })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, productId)),

    db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId)),

    db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, productId))
      .limit(1),

    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.displayOrder)),

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

// ============================================================
// マッピング関数
// ============================================================

const ACTRESS_PLACEHOLDER = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

/**
 * データベースの商品をProduct型に変換
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）。指定された言語のタイトル/説明を使用
 */
export function mapProductToType(
  product: DbProduct,
  performerData: Array<{ id: number; name: string; nameKana: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  tagData: Array<{ id: number; name: string; category: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  source?: any,
  cache?: any,
  imagesData?: Array<{ imageUrl: string; imageType: string; displayOrder: number | null }>,
  videosData?: Array<{ videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }>,
  locale: string = 'ja',
  saleData?: { regularPrice: number; salePrice: number; discountPercent: number | null; endAt?: Date | null }
): ProductType {
  const aspName = source?.aspName || 'DUGA';
  const mappedProvider = mapLegacyProvider(aspName);

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
    'HEYZO': 'HEYZO',
    'カリビアンコムプレミアム': 'カリビアンコムプレミアム',
    'CARIBBEANCOMPR': 'カリビアンコムプレミアム',
    'CARIBBEANCOM': 'カリビアンコム',
    '1PONDO': '一本道',
    '10MUSUME': '天然むすめ',
    'PACOPACOMAMA': 'パコパコママ',
  };
  const providerLabel = providerLabelMap[aspName.toUpperCase()] || providerLabelMap[aspName] || aspName;

  const price = cache?.price || source?.price || 0;
  const currency = source?.currency || 'JPY';

  let imageUrl = cache?.thumbnailUrl || product.defaultThumbnailUrl;
  if (!imageUrl && imagesData && imagesData.length > 0) {
    const thumbnailImg = imagesData.find(img => img.imageType === 'thumbnail');
    imageUrl = thumbnailImg?.imageUrl || imagesData[0].imageUrl;
  }
  if (!imageUrl) {
    imageUrl = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
  }

  const affiliateUrl = source?.affiliateUrl || cache?.affiliateUrl || '';

  const sampleImages = imagesData && imagesData.length > 0
    ? imagesData.map(img => img.imageUrl)
    : (cache?.sampleImages as string[] | undefined);

  const category: ProductCategory = 'premium';

  const actressId = performerData.length > 0 ? String(performerData[0].id) : undefined;
  const actressName = performerData.length > 0 ? getLocalizedPerformerName(performerData[0], locale) : undefined;

  const performersList = performerData.map(p => ({
    id: String(p.id),
    name: getLocalizedPerformerName(p, locale)
  }));

  const tagsList = tagData.map(t => getLocalizedTagName(t, locale));

  const { isNew, isFuture } = product.releaseDate ? (() => {
    const releaseDate = new Date(product.releaseDate);
    const now = new Date();
    const diffTime = now.getTime() - releaseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { isNew: false, isFuture: true };
    }
    return { isNew: diffDays <= 7, isFuture: false };
  })() : { isNew: false, isFuture: false };

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
    aiReview: product.aiReview || undefined,
    aiReviewUpdatedAt: product.aiReviewUpdatedAt?.toISOString(),
  };
}

/**
 * バッチ結果から商品を型変換するヘルパー関数
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export function mapProductsWithBatchData(
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
 * データベースの出演者(performer)をActress型に変換（同期版）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）。指定された言語の名前/バイオを使用
 */
export function mapPerformerToActressTypeSync(
  performer: DbPerformer,
  releaseCount: number,
  thumbnailUrl?: string,
  services?: string[],
  aliases?: string[],
  locale: string = 'ja'
): ActressType {
  const imageUrl = thumbnailUrl || ACTRESS_PLACEHOLDER;
  const providerIds = (services || [])
    .map(s => ASP_TO_PROVIDER_ID[s])
    .filter((id): id is ProviderId => id !== undefined);

  return {
    id: String(performer.id),
    name: getLocalizedPerformerName(performer, locale),
    nameKana: performer.nameKana || undefined,
    bio: getLocalizedPerformerBio(performer, locale),
    imageUrl,
    aliases: aliases || [],
    releaseCount,
    services: services || [],
    providerIds: providerIds.length > 0 ? providerIds : undefined,
    // 将来のフィールド用のプレースホルダー
    age: undefined,
    birthDate: undefined,
    height: undefined,
    bust: undefined,
    waist: undefined,
    hip: undefined,
    cupSize: undefined,
  };
}
