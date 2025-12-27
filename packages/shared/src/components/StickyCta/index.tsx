'use client';

import { useState, useEffect, useRef } from 'react';

type ThemeMode = 'dark' | 'light';

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
    urgentHours?: string;
    endsToday?: string;
    endsSoon?: string;
  };
  /** 信頼バッジを表示するか（A/Bテスト用） */
  showTrustBadge?: boolean;
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
        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400'
        : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600',
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
        ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400'
        : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
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
export function StickyCtaBase({
  affiliateUrl,
  providerLabel,
  price,
  salePrice,
  discount,
  currency = 'JPY',
  saleEndAt,
  theme = 'dark',
  labels,
  showTrustBadge = false,
}: StickyCtaBaseProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(false);
  const [urgencyText, setUrgencyText] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollThreshold = 300;

      // デスクトップ用：300px以上スクロールしたら表示
      const shouldShowDesktop = currentScrollY > scrollThreshold;
      setIsVisible(shouldShowDesktop);

      // モバイル用：スクロール方向に応じて表示制御
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

      if (diffHours <= 6) {
        setUrgencyText(labels.urgentHours?.replace('{hours}', String(diffHours)) || `残り${diffHours}時間`);
        setIsUrgent(true);
      } else if (diffHours <= 24) {
        setUrgencyText(labels.endsToday || '本日終了');
        setIsUrgent(true);
      } else if (diffDays <= 2) {
        setUrgencyText(labels.endsSoon?.replace('{days}', String(diffDays)) || `残り${diffDays}日`);
        setIsUrgent(false);
      } else {
        setUrgencyText(null);
        setIsUrgent(false);
      }
    };

    updateUrgency();
    const interval = setInterval(updateUrgency, 60000);
    return () => clearInterval(interval);
  }, [saleEndAt, salePrice, labels]);

  const formatPrice = (amount: number) => {
    if (currency === 'JPY') {
      return `¥${amount.toLocaleString()}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const displayPrice = salePrice || price;
  const isOnSale = salePrice && price && salePrice < price;
  const styles = getThemeStyles(theme, Boolean(isOnSale));

  if (!affiliateUrl || !displayPrice) return null;

  return (
    <>
      {/* モバイル版：画面下部固定バー */}
      <div
        className={`fixed bottom-0 left-0 right-0 md:hidden z-50 transition-transform duration-300 ${
          isMobileVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 緊急バッジ */}
        {urgencyText && isMobileVisible && (
          <div className={`text-center py-1.5 text-sm font-bold ${
            isUrgent ? 'bg-red-500 text-white animate-pulse' : styles.urgentBadge
          }`}>
            {urgencyText}
          </div>
        )}

        <div className={`backdrop-blur-md border-t px-4 py-3 safe-area-pb shadow-lg ${styles.mobileContainer}`}>
          <div className="flex items-center justify-between gap-3">
            {/* 価格表示 */}
            <div className="flex flex-col">
              {isOnSale ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${styles.priceText}`}>
                      {formatPrice(salePrice)}
                    </span>
                    {discount && (
                      <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded animate-bounce">
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <span className={`text-xs line-through ${styles.originalPriceText}`}>
                    {formatPrice(price)}
                  </span>
                </>
              ) : (
                <span className={`text-xl font-bold ${styles.priceText}`}>
                  {formatPrice(displayPrice)}
                </span>
              )}
            </div>

            {/* CTAボタン */}
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 max-w-xs py-3.5 px-6 text-white font-bold text-center rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${styles.buttonGradient}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {labels.buyAt}
            </a>
          </div>
        </div>
      </div>

      {/* デスクトップ版：右側フローティングボタン */}
      <div
        className={`fixed bottom-8 right-8 hidden md:block z-50 transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className={`rounded-2xl shadow-2xl overflow-hidden ${styles.desktopRing}`}>
          {/* 緊急バッジ */}
          {urgencyText && (
            <div className={`text-center py-1.5 px-4 text-sm font-bold ${
              isUrgent ? 'bg-red-500 text-white animate-pulse' : styles.urgentBadge
            }`}>
              {urgencyText}
            </div>
          )}

          <div className={`backdrop-blur-md p-4 ${styles.desktopContainer}`}>
            {/* 価格表示 */}
            <div className="flex flex-col items-center mb-3">
              {isOnSale ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${styles.priceText}`}>
                      {formatPrice(salePrice)}
                    </span>
                    {discount && (
                      <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <span className={`text-sm line-through ${styles.originalPriceText}`}>
                    {formatPrice(price)}
                  </span>
                </>
              ) : (
                <span className={`text-2xl font-bold ${styles.priceText}`}>
                  {formatPrice(displayPrice)}
                </span>
              )}
            </div>

            {/* CTAボタン */}
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full py-3 px-8 text-white font-bold text-center rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 ${styles.buttonGradient}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {labels.buyAt}
            </a>

            {/* プロバイダーラベル */}
            <p className={`text-center text-xs mt-2 ${styles.providerText}`}>
              {providerLabel}
            </p>

            {/* 信頼バッジ（A/Bテスト用） */}
            {showTrustBadge && (
              <div className={`flex items-center justify-center gap-2 mt-2 text-[10px] ${styles.providerText}`}>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  安全決済
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
