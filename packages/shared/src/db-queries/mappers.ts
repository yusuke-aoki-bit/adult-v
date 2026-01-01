/**
 * DBエンティティから型へのマッピング関数
 * 両アプリ（web/fanza）で共通使用
 */

import type { Actress as ActressType, ProviderId, ActressAiReview, Product as ProductType, ProductCategory } from '../types/product';
import type { BatchRelatedDataResult } from './core-queries';
import { ACTRESS_PLACEHOLDER, PRODUCT_PLACEHOLDER } from '../constants/app';
import { ASP_TO_PROVIDER_ID } from '../constants/filters';

// ============================================================
// Types
// ============================================================

/**
 * DBからの演者データ
 */
export interface DbPerformer {
  id: number;
  name: string;
  nameKana?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  aiReview?: string | null;
  aiReviewUpdatedAt?: Date | null;
  // 翻訳フィールド（オプション）
  nameEn?: string | null;
  nameZh?: string | null;
  nameKo?: string | null;
  bioEn?: string | null;
  bioZh?: string | null;
  bioKo?: string | null;
  // 詳細プロフィール
  age?: number | null;
  birthDate?: string | null;
  height?: number | null;
  bust?: number | null;
  waist?: number | null;
  hip?: number | null;
  cupSize?: string | null;
}

/**
 * マッパー関数の依存性
 */
export interface MapperDeps {
  getLocalizedPerformerName: (performer: DbPerformer, locale: string) => string;
  getLocalizedPerformerBio: (performer: DbPerformer, locale: string) => string | undefined;
  getLocalizedAiReview: (aiReview: string | null | undefined, locale: string) => ActressAiReview | undefined;
}

// ============================================================
// Product Mapper Types
// ============================================================

/**
 * DBからの商品データ
 */
export interface DbProduct {
  id: number;
  normalizedProductId?: string | null;
  title: string;
  releaseDate?: string | null;
  description?: string | null;
  duration?: number | null;
  defaultThumbnailUrl?: string | null;
  aiReview?: string | null;
  aiReviewUpdatedAt?: Date | null;
  // 翻訳フィールド（オプション）
  titleEn?: string | null;
  titleZh?: string | null;
  titleKo?: string | null;
  descriptionEn?: string | null;
  descriptionZh?: string | null;
  descriptionKo?: string | null;
}

/**
 * ソースデータ（product_sourcesから）
 */
export interface SourceData {
  aspName?: string;
  affiliateUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  originalProductId?: string | null;
  productType?: string | null;
}

/**
 * キャッシュデータ（バッチ取得用）
 */
export interface CacheData {
  price?: number;
  thumbnailUrl?: string;
  affiliateUrl?: string;
  sampleImages?: string[];
}

/**
 * 画像データ
 */
export interface ImageData {
  imageUrl: string;
  imageType: string;
  displayOrder: number | null;
}

/**
 * 動画データ
 */
export interface VideoData {
  videoUrl: string;
  videoType: string | null;
  quality: string | null;
  duration: number | null;
}

/**
 * セールデータ
 */
export interface SaleData {
  regularPrice: number;
  salePrice: number;
  discountPercent: number | null;
  endAt?: Date | null;
}

/**
 * 出演者データ（簡易版）
 */
export interface PerformerData {
  id: number;
  name: string;
  nameKana: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
  nameKo?: string | null;
}

/**
 * タグデータ
 */
export interface TagData {
  id: number;
  name: string;
  category: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
  nameKo?: string | null;
}

/**
 * 商品マッパー関数の依存性
 */
export interface ProductMapperDeps {
  mapLegacyProvider: (aspName: string) => ProviderId;
  getProviderLabel: (aspName: string) => string;
  getLocalizedPerformerName: (performer: PerformerData, locale: string) => string;
  getLocalizedTagName: (tag: TagData, locale: string) => string;
  getLocalizedTitle: (product: DbProduct, locale: string) => string;
  getLocalizedDescription: (product: DbProduct, locale: string) => string | undefined;
}

/**
 * DBの商品をProduct型に変換
 */
export function mapProductToType(
  product: DbProduct,
  deps: ProductMapperDeps,
  performerData: PerformerData[] = [],
  tagData: TagData[] = [],
  source?: SourceData | null,
  cache?: CacheData | null,
  imagesData?: ImageData[],
  videosData?: VideoData[],
  locale: string = 'ja',
  saleData?: SaleData
): ProductType {
  const {
    mapLegacyProvider,
    getProviderLabel,
    getLocalizedPerformerName,
    getLocalizedTagName,
    getLocalizedTitle,
    getLocalizedDescription,
  } = deps;

  // ASP情報から provider を取得
  const aspName = source?.aspName || 'DUGA';
  const mappedProvider = mapLegacyProvider(aspName);

  // ASP名を表示用ラベルに変換（共通関数使用）
  const providerLabel = getProviderLabel(aspName);

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
    imageUrl = PRODUCT_PLACEHOLDER;
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

// ============================================================
// Actress Mapper Functions
// ============================================================

/**
 * データベースの出演者(performer)をActress型に変換（同期版）
 * 画像優先順位: thumbnailUrl（作品サムネイル画像） > プレースホルダー
 * ※profileImageUrlはminnano-avから取得した画像のため使用しない
 *
 * @param performer - DBから取得した演者データ
 * @param releaseCount - 作品数
 * @param deps - 依存関数（ローカライズ関数）
 * @param options - オプション（thumbnailUrl, services, aliases, locale）
 */
export function mapPerformerToActressTypeSync(
  performer: DbPerformer,
  releaseCount: number,
  deps: MapperDeps,
  options: {
    thumbnailUrl?: string;
    services?: string[];
    aliases?: string[];
    locale?: string;
  } = {}
): ActressType {
  const { thumbnailUrl, services, aliases, locale = 'ja' } = options;
  const { getLocalizedPerformerName, getLocalizedPerformerBio, getLocalizedAiReview } = deps;

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

// ============================================================
// Batch Mapper Functions
// ============================================================

/**
 * 商品リストをバッチ取得した関連データでマッピングする依存性
 */
export interface MapProductsWithBatchDataDeps extends ProductMapperDeps {
  isValidPerformer: (performer: { name: string }) => boolean;
}

/**
 * 商品リストをバッチ取得した関連データでマッピング
 * batchFetchProductRelatedDataの結果を使って商品リストをProductType[]に変換
 *
 * @param productList - DBから取得した商品リスト
 * @param batchData - batchFetchProductRelatedDataの結果
 * @param deps - マッパー依存性（ローカライズ関数、バリデーション関数）
 * @param locale - ロケール
 */
export function mapProductsWithBatchData(
  productList: DbProduct[],
  batchData: BatchRelatedDataResult,
  deps: MapProductsWithBatchDataDeps,
  locale: string = 'ja'
): ProductType[] {
  const { isValidPerformer, ...productMapperDeps } = deps;

  return productList.map((product) => {
    const performerData = (batchData.performersMap.get(product.id) || []).filter(isValidPerformer);
    const tagData = batchData.tagsMap.get(product.id) || [];
    const imagesData = batchData.imagesMap.get(product.id);
    const videosData = batchData.videosMap.get(product.id);
    const saleData = batchData.salesMap.get(product.id);
    const mainSource = batchData.sourcesMap.get(product.id);

    const mappedProduct = mapProductToType(
      product,
      productMapperDeps,
      performerData,
      tagData,
      mainSource,
      undefined,
      imagesData,
      videosData,
      locale,
      saleData
    );

    // 他ASPソースを alternativeSources として追加
    const allSources = batchData.allSourcesMap?.get(product.id) || [];
    if (allSources.length > 1 && mainSource) {
      const mainAspName = mainSource.aspName?.toUpperCase();
      // メインソース以外のソースをalternativeSourcesに追加（FANZAは除外）
      const alternatives = allSources
        .filter(s =>
          s.aspName.toUpperCase() !== mainAspName &&
          s.aspName.toUpperCase() !== 'FANZA'
        )
        .map(s => ({
          aspName: s.aspName,
          price: s.price ?? 0,
          salePrice: undefined as number | undefined,
          affiliateUrl: s.affiliateUrl || '',
          productId: product.id,
        }));

      if (alternatives.length > 0) {
        mappedProduct.alternativeSources = alternatives;
      }
    }

    return mappedProduct;
  });
}
