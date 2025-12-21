'use client';

import { extractMgsProductUrl, convertFanzaToDirectUrl } from '../ProductCard/helpers';

export interface AffiliateButtonBaseProps {
  affiliateUrl: string;
  providerLabel: string;
  provider?: string;
  productId?: number | string;
  price?: number;
  salePrice?: number;
  discount?: number;
  /** FANZAアフィリエイトURLを直リンクに変換するか */
  convertFanzaUrls?: boolean;
  /** A/Bテスト用のgetVariant関数 */
  getVariant: (testName: string) => string;
  /** A/Bテスト用のtrackCtaClick関数 */
  trackCtaClick: (testName: string, productId: string | number, params?: Record<string, string | number | boolean>) => void;
}

/**
 * アフィリエイトボタン共通コンポーネント
 * MGSの場合は商品ページへのリンク、FANZAはオプションで直リンク変換
 */
export default function AffiliateButtonBase({
  affiliateUrl,
  providerLabel,
  provider,
  productId,
  price,
  salePrice,
  discount,
  convertFanzaUrls = false,
  getVariant,
  trackCtaClick,
}: AffiliateButtonBaseProps) {
  const isMgsWidget = affiliateUrl.includes('mgs_Widget_affiliate');
  const isFanzaUrl = affiliateUrl.includes('dmm.co.jp') || affiliateUrl.includes('al.dmm.co.jp');

  // MGSウィジェットの場合、商品ページURLを抽出
  let finalUrl = affiliateUrl;
  if (isMgsWidget) {
    const mgsUrl = extractMgsProductUrl(affiliateUrl);
    if (mgsUrl) {
      finalUrl = mgsUrl;
    } else {
      return null;
    }
  } else if (convertFanzaUrls && isFanzaUrl) {
    // FANZAの場合は直リンクに変換（オプション）
    finalUrl = convertFanzaToDirectUrl(affiliateUrl);
  }

  // URLが正常なリンクかどうかを確認
  const isValidUrl = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');
  if (!isValidUrl) {
    return null;
  }

  const hasSale = salePrice && price && salePrice < price;

  // A/Bテスト: CTAボタンテキストのバリエーション
  const ctaVariant = getVariant('ctaButtonText');
  const getCtaText = () => {
    if (hasSale) {
      switch (ctaVariant) {
        case 'urgency': return `${providerLabel}で今すぐ購入`;
        case 'action': return `${providerLabel}でお得にゲット`;
        default: return `${providerLabel}で今すぐ購入`;
      }
    } else {
      switch (ctaVariant) {
        case 'urgency': return `${providerLabel}で今すぐ見る`;
        case 'action': return `${providerLabel}をチェック`;
        default: return `${providerLabel}で購入`;
      }
    }
  };

  const handleCtaClick = () => {
    if (productId) {
      trackCtaClick('ctaButtonText', productId, {
        is_sale: !!hasSale,
        provider: provider || '',
        page_type: 'detail',
      });
    }
  };

  return (
    <div className="pt-4 space-y-3">
      {/* セール価格の強調表示 */}
      {hasSale && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-red-600 font-bold text-lg">🔥 セール中</span>
            {discount && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                {discount}%OFF
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-2xl font-bold text-red-600">¥{salePrice.toLocaleString()}</span>
            <span className="text-sm text-gray-500 line-through">¥{price.toLocaleString()}</span>
          </div>
        </div>
      )}
      <a
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleCtaClick}
        className={`flex items-center justify-center gap-2 w-full text-white text-center py-4 px-6 rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
          hasSale
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-rose-600 hover:bg-rose-700'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {getCtaText()}
      </a>
    </div>
  );
}
