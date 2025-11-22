import { DMMAffiliateLinkParams } from '@/types/product';

/**
 * DMMアフィリエイトリンクを生成する
 *
 * 実際の運用時は、以下の情報を設定してください：
 * - アフィリエイトID: DMMアフィリエイトに登録して取得
 * - サービスコード: 各サービスごとのコード
 *
 * 参考: https://affiliate.dmm.com/
 */

// 環境変数からアフィリエイトIDを取得（.env.localに設定）
const AFFILIATE_ID = process.env.NEXT_PUBLIC_DMM_AFFILIATE_ID || 'YOUR_AFFILIATE_ID';
const AFFILIATE_SITE_ID = process.env.NEXT_PUBLIC_DMM_AFFILIATE_SITE_ID || 'YOUR_SITE_ID';

/**
 * DMMアフィリエイトリンクを生成
 */
export function generateDMMLink(params: DMMAffiliateLinkParams): string {
  const { productId, service } = params;

  // 基本的なDMMアフィリエイトリンクの構造
  // 実際のリンク形式はDMMアフィリエイトの仕様に従ってください
  const baseUrl = 'https://www.dmm.com';
  const affiliateParams = new URLSearchParams({
    affiliate_id: AFFILIATE_ID,
    site_id: AFFILIATE_SITE_ID,
    service: service,
    product_id: productId,
  });

  return `${baseUrl}?${affiliateParams.toString()}`;
}

/**
 * サービスコードの定義
 */
export const DMM_SERVICES = {
  EBOOK: 'digital/ebook',
  VIDEO: 'digital/videoa',
  GAME: 'games',
  ENGLISH: 'eikaiwa',
  FX: 'fx',
  STOCK: 'securities',
  SOLAR: 'solar',
  MOBILE: 'mobile',
  SCRATCH: 'scratch',
} as const;

/**
 * カテゴリからサービスコードを取得
 */
export function getServiceCode(category: string): string {
  const serviceMap: Record<string, string> = {
    ebook: DMM_SERVICES.EBOOK,
    video: DMM_SERVICES.VIDEO,
    game: DMM_SERVICES.GAME,
    english: DMM_SERVICES.ENGLISH,
    fx: DMM_SERVICES.FX,
    stock: DMM_SERVICES.STOCK,
    solar: DMM_SERVICES.SOLAR,
    mobile: DMM_SERVICES.MOBILE,
    scratch: DMM_SERVICES.SCRATCH,
  };

  return serviceMap[category] || '';
}

/**
 * トラッキングパラメータを追加
 */
export function addTrackingParams(url: string, params: Record<string, string>): string {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });
  return urlObj.toString();
}

// DUGA アフィリエイト設定
// 代理店ID-バナーID形式
const DUGA_AFFILIATE_ID = process.env.NEXT_PUBLIC_DUGA_AFFILIATE_ID || '48611-01';

/**
 * DUGAアフィリエイトリンクを生成
 * 形式: https://click.duga.jp/ppv/{product-id}/{affiliate-id}
 * @param originalUrl 元のDUGA商品URL (例: http://duga.jp/ppv/dopyuch-0014/)
 * @returns アフィリエイトURL (例: https://click.duga.jp/ppv/dopyuch-0014/48611-01)
 */
export function generateDUGALink(originalUrl: string): string {
  try {
    // URLからパス部分を抽出
    // 例: http://duga.jp/ppv/dopyuch-0014/ → /ppv/dopyuch-0014/
    // 例: http://duga.jp/month/hot-1707/ → /month/hot-1707/
    const urlObj = new URL(originalUrl);
    let path = urlObj.pathname;

    // 末尾のスラッシュを削除
    path = path.replace(/\/$/, '');

    // click.duga.jp形式のURLを生成
    // https://click.duga.jp{path}/{affiliate-id}
    return `https://click.duga.jp${path}/${DUGA_AFFILIATE_ID}`;
  } catch {
    // URLパースに失敗した場合
    // パスを抽出して変換を試みる
    const pathMatch = originalUrl.match(/duga\.jp(\/[^\s?#]+)/);
    if (pathMatch) {
      const path = pathMatch[1].replace(/\/$/, '');
      return `https://click.duga.jp${path}/${DUGA_AFFILIATE_ID}`;
    }
    // 変換できない場合は元のURLを返す
    return originalUrl;
  }
}

// DTI (HEYZO, カリビアンコムプレミアム等) アフィリエイト設定
// clear-tv.com経由のアフィリエイトリンク形式
// HEYZO: 9450999-450-239360
// カリビアンコムプレミアム: 9290999-290-239360
const DTI_AFFILIATE_CODES = {
  heyzo: '9450999-450-239360',
  caribbeancompr: '9290999-290-239360',
  caribbeancom: '9290999-290-239360', // カリビアンコム
  '1pondo': '9200999-200-239360', // 一本道
} as const;

/**
 * HEYZOアフィリエイトリンクを生成
 * @param movieId 作品ID (例: "0442")
 * @returns アフィリエイトURL
 */
export function generateHEYZOLink(movieId: string): string {
  const affiliateCode = DTI_AFFILIATE_CODES.heyzo;
  return `https://clear-tv.com/Direct/${affiliateCode}/moviepages/${movieId}/index.html`;
}

/**
 * カリビアンコムプレミアムアフィリエイトリンクを生成
 * @param movieId 作品ID (例: "041924_002")
 * @returns アフィリエイトURL
 */
export function generateCaribbeancomPrLink(movieId: string): string {
  const affiliateCode = DTI_AFFILIATE_CODES.caribbeancompr;
  return `https://clear-tv.com/Direct/${affiliateCode}/moviepages/${movieId}/index.html`;
}

/**
 * DTIサイトのURLから作品IDを抽出
 * @param url 元のURL
 * @returns 作品ID or null
 */
export function extractDTIMovieId(url: string): string | null {
  // HEYZO: https://www.heyzo.com/moviepages/0442/index.html
  // カリビアンコムプレミアム: https://www.caribbeancompr.com/moviepages/041924_002/index.html
  // 一本道: https://www.1pondo.tv/movies/111924_001/
  const moviepagesMatch = url.match(/\/moviepages\/([^\/]+)/);
  if (moviepagesMatch) return moviepagesMatch[1];

  // 一本道の/movies/形式
  const moviesMatch = url.match(/\/movies\/([^\/]+)/);
  if (moviesMatch) return moviesMatch[1];

  return null;
}

/**
 * DTIサイトの種類を判定
 * @param url 元のURL
 * @returns サイト種類 or null
 */
export function detectDTISite(url: string): 'heyzo' | 'caribbeancompr' | 'caribbeancom' | '1pondo' | null {
  if (url.includes('heyzo.com')) return 'heyzo';
  if (url.includes('caribbeancompr.com')) return 'caribbeancompr';
  if (url.includes('caribbeancom.com')) return 'caribbeancom';
  if (url.includes('1pondo.tv')) return '1pondo';
  return null;
}

/**
 * DTIサイトのアフィリエイトリンクを生成
 * @param originalUrl 元のDTIサイトURL
 * @returns アフィリエイトURL
 */
export function generateDTILink(originalUrl: string): string {
  const site = detectDTISite(originalUrl);
  const movieId = extractDTIMovieId(originalUrl);

  if (!site || !movieId) {
    return originalUrl; // 変換できない場合は元のURLを返す
  }

  const affiliateCode = DTI_AFFILIATE_CODES[site];
  return `https://clear-tv.com/Direct/${affiliateCode}/moviepages/${movieId}/index.html`;
}

/**
 * プロバイダーに基づいてアフィリエイトリンクを生成
 */
export function generateAffiliateLink(originalUrl: string, provider: string): string {
  switch (provider.toLowerCase()) {
    case 'duga':
      return generateDUGALink(originalUrl);
    case 'dti':
    case 'heyzo':
    case 'caribbeancompr':
    case 'caribbeancom':
    case '1pondo':
      return generateDTILink(originalUrl);
    default:
      return originalUrl;
  }
}
