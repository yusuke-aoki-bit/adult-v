'use client';

import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

type ThemeMode = 'dark' | 'light';

/** セール緊急度の閾値設定 */
export interface UrgencyThresholds {
  /** 超緊急表示（赤pulse）の閾値（時間） - デフォルト: 6 */
  criticalHours?: number;
  /** 緊急表示（オレンジpulse）の閾値（時間） - デフォルト: 24 */
  urgentHours?: number;
  /** 終了間近表示の閾値（日数） - デフォルト: 2 */
  soonDays?: number;
}

export interface StickyCtaBaseProps {
  affiliateUrl: string;
  providerLabel: string;
  price?: number;
  salePrice?: number;
  discount?: number;
  currency?: string;
  saleEndAt?: string | null;
  theme?: ThemeMode;
  labels: {
    buyAt: string;
    buyAtSale?: string;
    urgentHours?: string;
    endsToday?: string;
    endsSoon?: string;
  };
  /** 信頼バッジを表示するか（A/Bテスト用） */
  showTrustBadge?: boolean;
  /** セール緊急度の閾値設定（オプション） */
  urgencyThresholds?: UrgencyThresholds;
  /** CTAクリック時のトラッキングコールバック */
  trackCtaClick?: (params: { provider: string; isSale: boolean; device: 'mobile' | 'desktop'; price?: number }) => void;
}

// テーマに応じたスタイル設定
const getThemeStyles = (theme: ThemeMode, isOnSale: boolean) => {
  if (theme === 'dark') {
    return {
      // モバイル
      mobileContainer: isOnSale ? 'bg-red-900/95 border-red-700' : 'bg-gray-900/95 border-gray-700',
      priceText: 'text-white',
      originalPriceText: 'text-gray-400',
      // デスクトップ
      desktopContainer: isOnSale ? 'bg-red-900/95' : 'bg-gray-900/95',
      desktopRing: isOnSale ? 'ring-2 ring-yellow-400/50' : '',
      providerText: 'text-gray-400',
      // ボタン
      buttonGradient: isOnSale
        ? 'bg-linear-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400'
        : 'bg-fuchsia-500 hover:bg-fuchsia-400',
      // 緊急バッジ
      urgentBadge: 'bg-yellow-500 text-black',
    };
  } else {
    return {
      // モバイル
      mobileContainer: isOnSale ? 'bg-red-50/95 border-red-200' : 'bg-white/95 border-gray-200',
      priceText: isOnSale ? 'text-red-600' : 'text-gray-900',
      originalPriceText: 'text-gray-500',
      // デスクトップ
      desktopContainer: isOnSale ? 'bg-red-50/95' : 'bg-white/95',
      desktopRing: isOnSale ? 'ring-2 ring-orange-400/50' : '',
      providerText: 'text-gray-500',
      // ボタン
      buttonGradient: isOnSale
        ? 'bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400'
        : 'bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
      // 緊急バッジ
      urgentBadge: 'bg-yellow-400 text-black',
    };
  }
};

/**
 * 固定CTAバー（モバイル：画面下部、デスクトップ：右側フローティング）
 * モバイル：スクロール方向に応じて表示制御（上スクロールで表示、下スクロールで非表示）
 * デスクトップ：スクロールダウン後に表示される購入ボタン
 * セール終了が近い場合は緊急感を演出
 */
// デフォルトの緊急度閾値
const DEFAULT_URGENCY_THRESHOLDS: Required<UrgencyThresholds> = {
  criticalHours: 6,
  urgentHours: 24,
  soonDays: 2,
};

export function StickyCtaBase({
  affiliateUrl,
  providerLabel,
  price,
  salePrice,
  discount,
  currency = 'JPY',
  saleEndAt,
  theme: themeProp,
  labels,
  showTrustBadge = false,
  urgencyThresholds,
  trackCtaClick,
}: StickyCtaBaseProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = (themeProp ?? contextTheme) as ThemeMode;
  // 閾値をマージ
  const thresholds = { ...DEFAULT_URGENCY_THRESHOLDS, ...urgencyThresholds };
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(false);
  const [urgencyText, setUrgencyText] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isCritical, setIsCritical] = useState(false); // 1時間以内の超緊急
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // クリック率向上のため早期表示（50px - より積極的に表示）
      const scrollThreshold = 50;

      // デスクトップ用：50px以上スクロールしたら表示
      const shouldShowDesktop = currentScrollY > scrollThreshold;
      setIsVisible(shouldShowDesktop);

      // モバイル用：スクロール方向に応じて表示制御（閾値も下げる）
      if (currentScrollY > scrollThreshold) {
        const scrollDelta = currentScrollY - lastScrollY.current;
        if (Math.abs(scrollDelta) > 10) {
          scrollDirection.current = scrollDelta > 0 ? 'down' : 'up';
        }
        const isNearBottom = window.innerHeight + currentScrollY >= document.body.offsetHeight - 100;
        setIsMobileVisible(scrollDirection.current === 'up' || isNearBottom);
      } else {
        setIsMobileVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // セール終了までの時間を計算
  useEffect(() => {
    if (!saleEndAt || !salePrice) return;

    const updateUrgency = () => {
      const end = new Date(saleEndAt);
      const now = new Date();
      const diffMs = end.getTime() - now.getTime();

      if (diffMs <= 0) {
        setUrgencyText(null);
        setIsUrgent(false);
        return;
      }

      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours <= 1) {
        // 1時間以内は超緊急表示
        setUrgencyText('⚠️ まもなく終了！残り1時間以内');
        setIsUrgent(true);
        setIsCritical(true);
      } else if (diffHours <= thresholds.criticalHours) {
        setUrgencyText(labels.urgentHours?.replace('{hours}', String(diffHours)) || `残り${diffHours}時間`);
        setIsUrgent(true);
        setIsCritical(false);
      } else if (diffHours <= thresholds.urgentHours) {
        setUrgencyText(labels.endsToday || '本日終了');
        setIsUrgent(true);
      } else if (diffDays <= thresholds.soonDays) {
        setUrgencyText(labels.endsSoon?.replace('{days}', String(diffDays)) || `残り${diffDays}日`);
        setIsUrgent(false);
        setIsCritical(false);
      } else {
        setUrgencyText(null);
        setIsUrgent(false);
        setIsCritical(false);
      }
    };

    updateUrgency();
    const interval = setInterval(updateUrgency, 60000);
    return () => clearInterval(interval);
  }, [saleEndAt, salePrice, labels, thresholds.criticalHours, thresholds.urgentHours, thresholds.soonDays]);

  const formatPrice = (amount: number) => {
    if (currency === 'JPY') {
      return `¥${amount.toLocaleString()}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const displayPrice = salePrice || price;
  const isOnSale = salePrice && price && salePrice < price;
  const styles = getThemeStyles(theme, Boolean(isOnSale));

  // セール時はbuyAtSale（割引率付き）、通常時はbuyAtを使用
  const ctaText =
    isOnSale && labels.buyAtSale && discount ? labels.buyAtSale.replace('{discount}', String(discount)) : labels.buyAt;

  if (!affiliateUrl || !displayPrice) return null;

  return (
    <>
      {/* モバイル版：画面下部固定バー */}
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 md:hidden ${
          prefersReducedMotion
            ? isMobileVisible
              ? ''
              : 'hidden'
            : `transition-transform duration-300 ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}`
        }`}
      >
        {/* 緊急バッジ - 1時間以内は超大型表示 */}
        {urgencyText && isMobileVisible && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`text-center font-bold ${
              isCritical
                ? `bg-linear-to-r from-red-600 via-orange-500 to-red-600 py-3 text-lg text-white ${prefersReducedMotion ? '' : 'animate-pulse'}`
                : isUrgent
                  ? `bg-red-500 py-1.5 text-sm text-white ${prefersReducedMotion ? '' : 'animate-pulse'}`
                  : `py-1.5 text-sm ${styles.urgentBadge}`
            }`}
          >
            {urgencyText}
          </div>
        )}

        <div className={`safe-area-pb border-t px-4 py-3 shadow-lg backdrop-blur-md ${styles.mobileContainer}`}>
          <div className="flex items-center justify-between gap-3">
            {/* 価格表示 */}
            <div className="flex flex-col">
              {isOnSale ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${styles.priceText}`}>{formatPrice(salePrice)}</span>
                    {discount && (
                      <span
                        className={`rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white ${prefersReducedMotion ? '' : 'animate-bounce'}`}
                      >
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <span className={`text-xs line-through ${styles.originalPriceText}`}>{formatPrice(price)}</span>
                </>
              ) : (
                <span className={`text-xl font-bold ${styles.priceText}`}>{formatPrice(displayPrice)}</span>
              )}
            </div>

            {/* CTAボタン */}
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${ctaText} - ${providerLabel}`}
              onClick={() =>
                trackCtaClick?.({
                  provider: providerLabel,
                  isSale: Boolean(isOnSale),
                  device: 'mobile',
                  price: displayPrice,
                })
              }
              className={`flex max-w-xs flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-center font-bold text-white shadow-lg transition-all active:scale-95 ${styles.buttonGradient}`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {ctaText}
            </a>
          </div>
        </div>
      </div>

      {/* デスクトップ版：右側フローティングボタン */}
      <div
        className={`fixed right-8 bottom-8 z-50 hidden md:block ${
          prefersReducedMotion
            ? isVisible
              ? ''
              : 'hidden'
            : `transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`
        }`}
      >
        <div className={`overflow-hidden rounded-2xl shadow-2xl ${styles.desktopRing}`}>
          {/* 緊急バッジ - 1時間以内は超大型表示 */}
          {urgencyText && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`px-4 text-center font-bold ${
                isCritical
                  ? `bg-linear-to-r from-red-600 via-orange-500 to-red-600 py-3 text-base text-white ${prefersReducedMotion ? '' : 'animate-pulse'}`
                  : isUrgent
                    ? `bg-red-500 py-1.5 text-sm text-white ${prefersReducedMotion ? '' : 'animate-pulse'}`
                    : `py-1.5 text-sm ${styles.urgentBadge}`
              }`}
            >
              {urgencyText}
            </div>
          )}

          <div className={`p-4 backdrop-blur-md ${styles.desktopContainer}`}>
            {/* 価格表示 */}
            <div className="mb-3 flex flex-col items-center">
              {isOnSale ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${styles.priceText}`}>{formatPrice(salePrice)}</span>
                    {discount && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <span className={`text-sm line-through ${styles.originalPriceText}`}>{formatPrice(price)}</span>
                </>
              ) : (
                <span className={`text-2xl font-bold ${styles.priceText}`}>{formatPrice(displayPrice)}</span>
              )}
            </div>

            {/* CTAボタン */}
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${ctaText} - ${providerLabel}`}
              onClick={() =>
                trackCtaClick?.({
                  provider: providerLabel,
                  isSale: Boolean(isOnSale),
                  device: 'desktop',
                  price: displayPrice,
                })
              }
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3 text-center font-bold text-white shadow-lg shadow-fuchsia-500/25 transition-all hover:scale-105 hover:shadow-fuchsia-500/40 ${styles.buttonGradient}`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {ctaText}
            </a>

            {/* プロバイダーラベル */}
            <p className={`mt-2 text-center text-xs ${styles.providerText}`}>{providerLabel}</p>

            {/* 信頼バッジ（A/Bテスト用） */}
            {showTrustBadge && (
              <div className={`mt-2 flex items-center justify-center gap-2 text-[10px] ${styles.providerText}`}>
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  安全決済
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  公式
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default StickyCtaBase;
