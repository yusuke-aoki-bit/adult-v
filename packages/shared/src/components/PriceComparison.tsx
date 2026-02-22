'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { isSubscriptionProvider } from '../lib/providers';
import { useTranslations } from 'next-intl';
import { useSiteTheme } from '../contexts/SiteThemeContext';

interface PriceOption {
  asp: string;
  aspLabel: string;
  price: number;
  affiliateUrl: string;
  inStock: boolean;
}

export type PriceComparisonTheme = 'dark' | 'light';

interface PriceComparisonProps {
  productId: string;
  theme?: PriceComparisonTheme;
}

// Theme configuration
const themeConfig = {
  dark: {
    container: 'bg-gray-800 rounded-xl p-6 shadow-lg',
    title: 'text-lg font-semibold text-gray-100 mb-4',
    skeletonBg: 'bg-gray-700',
    rowBest: 'border-green-500 bg-green-900/30',
    rowDefault: 'border-gray-600 bg-gray-700',
    aspLabel: 'font-semibold text-gray-100',
    price: 'text-2xl font-bold text-gray-100',
    subscriptionPrice: 'text-lg font-bold text-rose-400',
    lowestBadge: 'px-3 py-1 bg-rose-500 text-white text-xs font-semibold rounded-full',
    outOfStockBadge: 'px-3 py-1 bg-gray-500 text-white text-xs font-semibold rounded-full',
    buyButtonActive: 'bg-gray-100 hover:bg-white text-gray-900',
    buyButtonDisabled: 'bg-gray-600 cursor-not-allowed text-gray-400',
    disclaimer: 'text-xs text-gray-400 mt-4',
  },
  light: {
    container: 'bg-white rounded-xl p-6 shadow-lg',
    title: 'text-lg font-semibold text-gray-900 mb-4',
    skeletonBg: 'bg-gray-200',
    rowBest: 'border-green-500 bg-green-50',
    rowDefault: 'border-gray-200 bg-gray-50',
    aspLabel: 'font-semibold text-gray-900',
    price: 'text-2xl font-bold text-gray-900',
    subscriptionPrice: 'text-lg font-bold text-rose-600',
    lowestBadge: 'px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-full',
    outOfStockBadge: 'px-3 py-1 bg-gray-400 text-white text-xs font-semibold rounded-full',
    buyButtonActive: 'bg-gray-900 hover:bg-gray-800 text-white',
    buyButtonDisabled: 'bg-gray-400 cursor-not-allowed text-white',
    disclaimer: 'text-xs text-gray-500 mt-4',
  },
} as const;

/**
 * MGS商品IDを正規化（ハイフンがない場合は適切な位置に挿入）
 * 例: 259LUXU1010 → 259LUXU-1010, CAWD157 → CAWD-157
 */
function normalizeMgsProductId(productId: string): string {
  if (productId.includes('-')) {
    return productId;
  }

  // パターン: 数字プレフィックス + 英字 + 数字（例: 259LUXU1010）
  const prefixMatch = productId.match(/^(\d+)([A-Z]+)(\d+)$/i);
  if (prefixMatch) {
    return `${prefixMatch[1]}${prefixMatch[2]}-${prefixMatch[3]}`;
  }

  // パターン: 英字 + 数字（例: CAWD157）
  const simpleMatch = productId.match(/^([A-Z]+)(\d+)$/i);
  if (simpleMatch) {
    return `${simpleMatch[1]}-${simpleMatch[2]}`;
  }

  return productId;
}

/**
 * MGSウィジェットコードからMGS商品ページURLを生成
 * aff=でアフィリエイト追跡
 */
function extractMgsAffiliateUrl(widgetCode: string): string | null {
  const productIdMatch = widgetCode.match(/[?&]p=([^&"']+)/);
  const affCodeMatch = widgetCode.match(/[?&]c=([^&"']+)/);

  if (productIdMatch?.[1]) {
    const rawProductId = productIdMatch[1];
    const productId = normalizeMgsProductId(rawProductId);
    const affCode = affCodeMatch?.[1] ?? '';
    // aff= でアフィリエイトコードを付与（MGS標準の年齢認証を経由）
    const affParam = affCode ? `?aff=${affCode}` : '';
    return `https://www.mgstage.com/product/product_detail/${productId}/${affParam}`;
  }
  return null;
}

/**
 * アフィリエイトURLを正規化（MGSウィジェットの場合はURLに変換）
 */
function normalizeAffiliateUrl(url: string): string {
  if (url.includes('mgs_Widget_affiliate')) {
    return extractMgsAffiliateUrl(url) || url;
  }
  return url;
}

/**
 * 価格比較コンポーネント
 * 複数ASPの価格を比較表示
 */
function PriceComparison({ productId, theme: themeProp }: PriceComparisonProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = (themeProp ?? contextTheme) as PriceComparisonTheme;
  const t = useTranslations('priceComparison');
  const colors = themeConfig[theme];
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const response = await fetch(`/api/products/${productId}/prices`);
        if (!response.ok) {
          throw new Error('価格情報の取得に失敗しました');
        }
        const data = await response.json();
        setPrices(data.prices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '価格情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchPrices();
  }, [productId]);

  if (loading) {
    return (
      <div className={colors.container}>
        <h3 className={colors.title}>{t('title')}</h3>
        <div className="animate-pulse space-y-3">
          <div className={`h-16 ${colors.skeletonBg} rounded`}></div>
          <div className={`h-16 ${colors.skeletonBg} rounded`}></div>
        </div>
      </div>
    );
  }

  // 最安値を計算（月額会員限定の価格0は除外）- useMemoで再計算を最小化
  const lowestPrice = useMemo(() => {
    const pricedOptions = prices.filter(p => p.inStock && p.price > 0);
    return pricedOptions.length > 0 ? Math.min(...pricedOptions.map(p => p.price)) : 0;
  }, [prices]);

  if (error || prices.length === 0) {
    return null;
  }

  return (
    <div className={colors.container}>
      <h3 className={colors.title}>{t('title')}</h3>
      <div className="space-y-3">
        {prices.map((option) => (
          <div
            key={`${option.asp}-${option.affiliateUrl}`}
            className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              option.inStock && option.price > 0 && option.price === lowestPrice
                ? colors.rowBest
                : colors.rowDefault
            }`}
          >
            <div className="flex items-center gap-3">
              <div>
                <p className={colors.aspLabel}>{option.aspLabel}</p>
                {option.price > 0 ? (
                  <p className={colors.price}>¥{option.price.toLocaleString()}</p>
                ) : isSubscriptionProvider(option.asp) ? (
                  <p className={colors.subscriptionPrice}>{t('subscriptionOnly')}</p>
                ) : (
                  <p className={colors.price}>¥{option.price.toLocaleString()}</p>
                )}
              </div>
              {option.inStock && option.price > 0 && option.price === lowestPrice && (
                <span className={colors.lowestBadge}>
                  {t('lowestPrice')}
                </span>
              )}
              {!option.inStock && (
                <span className={colors.outOfStockBadge}>
                  {t('outOfStock')}
                </span>
              )}
            </div>
            <a
              href={normalizeAffiliateUrl(option.affiliateUrl)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg font-semibold ${
                option.inStock
                  ? colors.buyButtonActive
                  : colors.buyButtonDisabled
              }`}
              onClick={(e) => {
                if (!option.inStock) {
                  e.preventDefault();
                }
              }}
            >
              {t('buy')}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        ))}
      </div>
      <p className={colors.disclaimer}>
        {t('priceDisclaimer')}
      </p>
    </div>
  );
}

export default memo(PriceComparison);
