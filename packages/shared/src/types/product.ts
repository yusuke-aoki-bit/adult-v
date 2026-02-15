// 取り扱いプロバイダ（asp-registry.ts から自動導出）
export type { ProviderId } from '../asp-registry';
import type { ProviderId } from '../asp-registry';

// 商品カテゴリ（ジャンル）の定義
export type ProductCategory =
  | 'all'            // すべて
  | 'premium'        // 王道・人気女優
  | 'mature'         // 熟女・人妻
  | 'fetish'         // マニアックジャンル
  | 'vr'             // VR・4K
  | 'cosplay'        // コスプレ・企画
  | 'indies';        // 素人・インディーズ

// 通貨コード
export type CurrencyCode = 'JPY' | 'USD';

// 作品（商品）の型定義
export interface Product {
  id: string;
  normalizedProductId?: string; // 正規化された商品ID (例: 107start-470)
  makerProductCode?: string; // メーカー品番 (例: START-470, SSIS-865)
  originalProductId?: string; // ASPごとのオリジナル商品ID
  title: string;
  description?: string;
  price: number;
  currency?: CurrencyCode; // 通貨 (デフォルト: JPY)
  category?: ProductCategory;
  imageUrl?: string;
  affiliateUrl?: string;
  provider?: ProviderId;
  providerLabel?: string;
  actressId?: string;
  actressName?: string;
  // Multiple performers support
  performers?: Array<{ id: string; name: string }>;
  releaseDate?: string;
  duration?: number; // minutes
  format?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  isFeatured?: boolean;
  isNew?: boolean;
  isFuture?: boolean; // 発売予定（リリース日が未来）
  productType?: 'haishin' | 'dvd' | 'monthly'; // MGS商品タイプ（配信/DVD/月額）
  discount?: number;
  salePrice?: number; // セール価格
  regularPrice?: number; // 通常価格（セール時の元値）
  saleEndAt?: string; // セール終了日時（ISO 8601形式）
  reviewHighlight?: string;
  ctaLabel?: string;
  sampleImages?: string[]; // サンプル画像URL配列
  sampleVideos?: Array<{
    url: string;
    type: string; // 'streaming', 'download', 'preview', 'trailer'
    quality?: string; // '720p', '1080p', '4k'
    duration?: number; // seconds
  }>; // サンプル動画URL配列
  // AI生成コンテンツ
  aiReview?: string; // AI生成のレビュー
  aiReviewUpdatedAt?: string; // AI生成レビュー更新日時
  // 同じ作品の他ASPソース（タイトルベース名寄せ用）
  alternativeSources?: Array<{
    aspName: string;
    price: number;
    salePrice?: number;
    affiliateUrl: string;
    productId: number;
  }>;
}

// カテゴリ情報
export interface CategoryInfo {
  id: ProductCategory;
  name: string;
  description: string;
  icon: string;
  exampleServices: ProviderId[];
}

// AIレビュー情報
export interface ActressAiReview {
  overview: string;           // 演者の総合的な紹介
  style: string;              // 演技スタイル・特徴
  appeal: string;             // 魅力ポイント
  recommendation: string;     // おすすめコメント
  keywords: string[];         // 検索キーワード
}

// 女優情報
export interface Actress {
  id: string;
  name: string;
  nameKana?: string; // ふりがな
  bio?: string; // 自己紹介・プロフィール
  imageUrl?: string; // プロフィール画像URL
  catchcopy?: string;
  description?: string;
  heroImage?: string;
  thumbnail?: string;
  primaryGenres?: ProductCategory[];
  services?: ProviderId[];
  metrics?: {
    releaseCount: number;
    trendingScore: number;
    fanScore: number;
  };
  highlightWorks?: string[];
  tags?: string[];
  aliases?: string[]; // 別名リスト
  releaseCount?: number; // 作品数
  aiReview?: ActressAiReview; // AI生成レビュー
  aiReviewUpdatedAt?: string; // AI生成レビュー更新日時
  // 詳細プロフィール（オプション）
  age?: number;
  birthDate?: string;
  height?: number;
  bust?: number;
  waist?: number;
  hip?: number;
  cupSize?: string;
}

// キャンペーン情報
export interface Campaign {
  id: string;
  provider: ProviderId;
  title: string;
  description: string;
  highlight: string;
  expiresAt: string;
  ctaUrl: string;
  badge?: string;
  genres?: ProductCategory[];
}

// プロバイダの表示情報
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  accentClass: string;
  textClass: string;
  description: string;
  siteUrl: string;
  /** Gradient colors for inline styles (avoids long Tailwind class names) */
  gradientColors?: { from: string; to: string };
}

// ランキング表示用
export interface RankingEntry {
  id: string;
  position: number;
  title: string;
  metric: string;
  delta?: string;
}

// ソートオプション
export type SortOption =
  | 'releaseDateDesc'    // リリース日（新しい順）
  | 'releaseDateAsc'     // リリース日（古い順）
  | 'priceDesc'          // 価格（高い順）
  | 'priceAsc'           // 価格（安い順）
  | 'ratingDesc'         // 評価（高い順）
  | 'ratingAsc'          // 評価（低い順）
  | 'reviewCountDesc'    // レビュー数（多い順）
  | 'titleAsc'           // タイトル（あいうえお順）
  | 'nameAsc'            // タイトル（A-Z）
  | 'nameDesc'           // タイトル（Z-A）
  | 'viewsDesc';         // 閲覧数（多い順）

// 出演者タイプ
export type PerformerType = 'solo' | 'multi';

// セール商品情報
export interface SaleProduct {
  productId: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: Date | null;
  performers: Array<{ id: number; name: string; profileImageUrl?: string | null }>;
}
