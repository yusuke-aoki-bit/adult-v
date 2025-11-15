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
