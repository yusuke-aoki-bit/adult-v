'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface StickyCtaProps {
  affiliateUrl: string;
  providerLabel: string;
  price?: number;
  salePrice?: number;
  discount?: number;
  currency?: string;
}

/**
 * モバイル用固定CTAバー
 * スクロールダウン後に画面下部に表示される購入ボタン
 */
export default function StickyCta({
  affiliateUrl,
  providerLabel,
  price,
  salePrice,
  discount,
  currency = 'JPY',
}: StickyCtaProps) {
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations('stickyCta');

  useEffect(() => {
    const handleScroll = () => {
      // 300px以上スクロールしたら表示
      const shouldShow = window.scrollY > 300;
      setIsVisible(shouldShow);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatPrice = (amount: number) => {
    if (currency === 'JPY') {
      return `¥${amount.toLocaleString()}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const displayPrice = salePrice || price;

  if (!affiliateUrl || !displayPrice) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 md:hidden z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 safe-area-pb shadow-lg">
        <div className="flex items-center justify-between gap-3">
          {/* 価格表示 */}
          <div className="flex flex-col">
            {salePrice && price && salePrice < price ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-red-600">
                    {formatPrice(salePrice)}
                  </span>
                  {discount && (
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                      -{discount}%
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 line-through">
                  {formatPrice(price)}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(displayPrice)}
              </span>
            )}
          </div>

          {/* CTAボタン */}
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-xs py-3 px-6 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-center rounded-lg shadow-lg transition-all active:scale-95"
          >
            {t('buyAt', { provider: providerLabel })}
          </a>
        </div>
      </div>
    </div>
  );
}
