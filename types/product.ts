// 取り扱いプロバイダ
export type ProviderId = 'dmm' | 'duga' | 'sokmil' | 'dti';

// 商品カテゴリ（ジャンル）の定義
export type ProductCategory =
  | 'all'            // すべて
  | 'premium'        // 王道・人気女優
  | 'mature'         // 熟女・人妻
  | 'fetish'         // マニアックジャンル
  | 'vr'             // VR・4K
  | 'cosplay'        // コスプレ・企画
  | 'indies';        // 素人・インディーズ

// 作品（商品）の型定義
export interface Product {
  id: string;
  normalizedProductId?: string; // 正規化された商品ID
  originalProductId?: string; // メーカー品番（ASPごと）
  title: string;
  description: string;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  affiliateUrl: string;
  provider: ProviderId;
  providerLabel: string;
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
  discount?: number;
  reviewHighlight?: string;
  ctaLabel?: string;
  sampleImages?: string[]; // サンプル画像URL配列
  sampleVideos?: Array<{
    url: string;
    type: string; // 'streaming', 'download', 'preview', 'trailer'
    quality?: string; // '720p', '1080p', '4k'
    duration?: number; // seconds
  }>; // サンプル動画URL配列
}

// カテゴリ情報
export interface CategoryInfo {
  id: ProductCategory;
  name: string;
  description: string;
  icon: string;
  exampleServices: ProviderId[];
}

// 女優情報
export interface Actress {
  id: string;
  name: string;
  catchcopy: string;
  description: string;
  heroImage: string;
  thumbnail: string;
  primaryGenres: ProductCategory[];
  services: ProviderId[];
  metrics: {
    releaseCount: number;
    trendingScore: number;
    fanScore: number;
  };
  highlightWorks: string[];
  tags: string[];
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
}

// ランキング表示用
export interface RankingEntry {
  id: string;
  position: number;
  title: string;
  metric: string;
  delta?: string;
}

// DMM アフィリエイトリンク生成用の型
export interface DMMAffiliateLinkParams {
  productId: string;
  affiliateId: string;
  service: string;
}

// ソートオプション
export type SortOption = 
  | 'releaseDateDesc'    // リリース日（新しい順）
  | 'releaseDateAsc'     // リリース日（古い順）
  | 'priceDesc'          // 価格（高い順）
  | 'priceAsc'           // 価格（安い順）
  | 'ratingDesc'         // 評価（高い順）
  | 'ratingAsc'          // 評価（低い順）
  | 'titleAsc';          // タイトル（あいうえお順）
