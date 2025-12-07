// 取り扱いプロバイダ
// DTI系サービスは個別に分離: caribbeancom, caribbeancompr, 1pondo, heyzo, 10musume, pacopacomama, etc.
export type ProviderId =
  | 'duga'
  | 'sokmil'
  | 'dti'  // レガシー用（後方互換性）
  | 'mgs'
  | 'b10f'
  | 'japanska'
  | 'fc2'
  // DTI個別サービス
  | 'caribbeancom'      // カリビアンコム
  | 'caribbeancompr'    // カリビアンコムプレミアム
  | '1pondo'            // 一本道
  | 'heyzo'             // HEYZO
  | '10musume'          // 天然むすめ
  | 'pacopacomama'      // パコパコママ
  | 'muramura'          // ムラムラってくる素人
  | 'tokyohot';         // Tokyo-Hot

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
  normalizedProductId?: string; // 正規化された商品ID
  originalProductId?: string; // メーカー品番（ASPごと）
  title: string;
  description: string;
  price: number;
  currency?: CurrencyCode; // 通貨 (デフォルト: JPY)
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
  isFuture?: boolean; // 発売予定（リリース日が未来）
  discount?: number;
  salePrice?: number; // セール価格
  regularPrice?: number; // 通常価格（セール時の元値）
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
  aliases?: string[]; // 別名リスト
  aiReview?: ActressAiReview; // AI生成レビュー
  aiReviewUpdatedAt?: string; // AI生成レビュー更新日時
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

// ソートオプション
export type SortOption = 
  | 'releaseDateDesc'    // リリース日（新しい順）
  | 'releaseDateAsc'     // リリース日（古い順）
  | 'priceDesc'          // 価格（高い順）
  | 'priceAsc'           // 価格（安い順）
  | 'ratingDesc'         // 評価（高い順）
  | 'ratingAsc'          // 評価（低い順）
  | 'titleAsc';          // タイトル（あいうえお順）
