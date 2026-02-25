'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Tag, Clock, Crown, TrendingDown } from 'lucide-react';
import { providerMeta, type ProviderId } from '../providers';
import { getTranslation, priceComparisonTranslations } from '../lib/translations';

interface PriceSource {
  aspName: string;
  originalProductId: string | null;
  regularPrice: number | null;
  salePrice: number | null;
  discountPercent: number | null;
  saleEndAt: Date | null;
  currency: string | null;
  affiliateUrl: string;
  isSubscription: boolean | null;
  productType: string | null;
  isOnSale: boolean;
}

interface PriceComparisonServerProps {
  sources: PriceSource[];
  locale: string;
}

type Translation = {
  title: string;
  titleSingle: string;
  cheapest: string;
  sale: string;
  subscription: string;
  regularPrice: string;
  salePrice: string;
  discount: string;
  saleEnds: string;
  today: string;
  daysLeft: string;
  buyNow: string;
  noPrice: string;
  savings: string;
  compare: string;
};

// ASP名からProviderIdへのマッピング
const ASP_TO_PROVIDER: Record<string, ProviderId> = {
  FANZA: 'fanza',
  DMM: 'fanza',
  MGS: 'mgs',
  DUGA: 'duga',
  APEX: 'duga',
  SOKMIL: 'sokmil',
  ソクミル: 'sokmil',
  FC2: 'fc2',
  B10F: 'b10f',
  JAPANSKA: 'japanska',
  caribbeancom: 'caribbeancom',
  caribbeancompr: 'caribbeancompr',
  '1pondo': '1pondo',
  heyzo: 'heyzo',
  '10musume': '10musume',
  pacopacomama: 'pacopacomama',
  tokyohot: 'tokyohot',
};

function getDaysUntilEnd(endAt: Date | null, now: Date): number | null {
  if (!endAt) return null;
  const diffMs = endAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatSaleEnd(endAt: Date | null, now: Date, t: Translation): string | null {
  const days = getDaysUntilEnd(endAt, now);
  if (days === null) return null;
  if (days <= 0) return t.today;
  return t.daysLeft.replace('{days}', String(days));
}

/**
 * 価格比較コンポーネント（クライアントサイドで現在時刻を取得）
 * 複数ASPの価格を比較表示
 */
export default function PriceComparisonServer({ sources, locale }: PriceComparisonServerProps) {
  const [now, setNow] = useState<Date | null>(null);
  const t = getTranslation(priceComparisonTranslations, locale);

  // クライアントサイドで現在時刻を取得（ハイドレーション後）
  useEffect(() => {
    setNow(new Date());
  }, []);

  // 現在時刻（SSR時はフォールバック値を使用）
  const currentNow = now || new Date();

  // Filter out sources without price
  const sourcesWithPrice = sources.filter((s) => s.regularPrice !== null || s.salePrice !== null);

  if (sourcesWithPrice.length === 0) {
    return null;
  }

  const isMultiple = sourcesWithPrice.length >= 2;

  // Find cheapest price
  const cheapestSource = sourcesWithPrice[0]!; // Already sorted by price
  const cheapestPrice = cheapestSource.salePrice ?? cheapestSource.regularPrice ?? 0;

  // Calculate max savings compared to highest price
  const highestPrice = Math.max(...sourcesWithPrice.map((s) => s.regularPrice ?? s.salePrice ?? 0));
  const maxSavings = isMultiple ? highestPrice - cheapestPrice : 0;

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
        <Tag className="h-5 w-5 text-emerald-400" />
        {isMultiple ? t.title : t.titleSingle}
        {isMultiple && (
          <span className="text-sm font-normal text-gray-400">
            ({sourcesWithPrice.length} {t.compare})
          </span>
        )}
        {maxSavings > 0 && (
          <span className="ml-auto text-sm font-normal text-emerald-400">
            {t.savings}: ¥{maxSavings.toLocaleString()}
          </span>
        )}
      </h3>

      <div className="space-y-2">
        {sourcesWithPrice.map((source, index) => {
          const providerId = ASP_TO_PROVIDER[source.aspName];
          const meta = providerId ? providerMeta[providerId] : null;
          const isCheapest = index === 0;
          const saleEndText = formatSaleEnd(source.saleEndAt, currentNow, t);
          const daysLeft = getDaysUntilEnd(source.saleEndAt, currentNow);
          const isUrgent = daysLeft !== null && daysLeft <= 3;
          // 有効なURLかチェック（http/httpsで始まるもののみ）
          const isValidUrl = source.affiliateUrl && source.affiliateUrl.startsWith('http');
          // 無効なURLの場合はスキップ
          if (!isValidUrl) return null;

          return (
            <a
              key={`${source.aspName}-${source.originalProductId}`}
              href={source.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => {
                if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
                  window.gtag('event', 'price_comparison_click', {
                    provider: source.aspName,
                    price: source.salePrice ?? source.regularPrice,
                    is_sale: source.isOnSale,
                    is_cheapest: isCheapest,
                    position: index + 1,
                  });
                }
              }}
              className={`group flex items-center gap-3 rounded-lg p-3 transition-all ${
                isCheapest
                  ? 'border border-emerald-500/30 bg-emerald-900/30 hover:bg-emerald-900/50'
                  : 'bg-gray-750 hover:bg-gray-700'
              }`}
            >
              {/* Provider badge */}
              <div
                className="shrink-0 rounded px-2 py-1 text-xs font-bold text-white"
                style={
                  meta?.gradientColors
                    ? {
                        background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`,
                      }
                    : { backgroundColor: '#4b5563' }
                }
              >
                {meta?.label || source.aspName}
              </div>

              {/* Price info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {source.isOnSale && source.salePrice ? (
                    <>
                      <span className="text-lg font-bold text-fuchsia-400">¥{source.salePrice.toLocaleString()}</span>
                      {source.regularPrice && (
                        <span className="text-sm text-gray-500 line-through">
                          ¥{source.regularPrice.toLocaleString()}
                        </span>
                      )}
                      {source.discountPercent && (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">
                          -{source.discountPercent}% {t.discount}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-lg font-bold text-white">
                      {source.regularPrice ? (
                        <>
                          {source.isSubscription && (
                            <span className="mr-1 text-xs text-gray-400">{t.subscription}</span>
                          )}
                          ¥{source.regularPrice.toLocaleString()}
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">{t.noPrice}</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Sale end info - nowがnullの場合（SSR時）は表示しない */}
                {now && source.isOnSale && saleEndText && (
                  <div
                    className={`mt-1 flex items-center gap-1 text-xs ${isUrgent ? 'text-red-400' : 'text-gray-500'}`}
                  >
                    <Clock className="h-3 w-3" />
                    {t.saleEnds}: {saleEndText}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex shrink-0 items-center gap-2">
                {isMultiple && isCheapest && (
                  <span className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                    <Crown className="h-3 w-3" />
                    {t.cheapest}
                  </span>
                )}
                {source.isOnSale && !(isMultiple && isCheapest) && (
                  <span className="flex items-center gap-1 rounded bg-fuchsia-600 px-2 py-1 text-xs text-white">
                    <TrendingDown className="h-3 w-3" />
                    {t.sale}
                  </span>
                )}
                <ExternalLink className="h-4 w-4 text-gray-500 transition-colors group-hover:text-white" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
