import { ExternalLink, Tag, Clock, Crown, TrendingDown } from 'lucide-react';
import { providerMeta, type ProviderId } from '../providers';

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

const translations = {
  ja: {
    title: '購入先を選択',
    titleSingle: '購入先',
    cheapest: '最安',
    sale: 'セール中',
    subscription: '月額',
    regularPrice: '通常価格',
    salePrice: 'セール価格',
    discount: 'OFF',
    saleEnds: 'セール終了',
    today: '本日まで',
    daysLeft: 'あと{days}日',
    buyNow: '購入する',
    noPrice: '価格情報なし',
    savings: '最大節約',
    compare: 'サイト',
  },
  en: {
    title: 'Where to Buy',
    titleSingle: 'Purchase',
    cheapest: 'Best Price',
    sale: 'On Sale',
    subscription: 'Monthly',
    regularPrice: 'Regular',
    salePrice: 'Sale',
    discount: 'OFF',
    saleEnds: 'Sale ends',
    today: 'Today',
    daysLeft: '{days} days left',
    buyNow: 'Buy',
    noPrice: 'Price unavailable',
    savings: 'Max savings',
    compare: 'sources',
  },
  zh: {
    title: '购买渠道',
    titleSingle: '购买',
    cheapest: '最低价',
    sale: '促销中',
    subscription: '月费',
    regularPrice: '原价',
    salePrice: '促销价',
    discount: '折扣',
    saleEnds: '促销结束',
    today: '今日截止',
    daysLeft: '剩余{days}天',
    buyNow: '购买',
    noPrice: '价格未知',
    savings: '最大节省',
    compare: '来源',
  },
  ko: {
    title: '구매처 선택',
    titleSingle: '구매',
    cheapest: '최저가',
    sale: '세일 중',
    subscription: '월정액',
    regularPrice: '정가',
    salePrice: '세일가',
    discount: '할인',
    saleEnds: '세일 종료',
    today: '오늘까지',
    daysLeft: '{days}일 남음',
    buyNow: '구매',
    noPrice: '가격 정보 없음',
    savings: '최대 절약',
    compare: '출처',
  },
} as const;

type Translations = typeof translations;
type TranslationKey = keyof Translations;
type Translation = Translations[TranslationKey];

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

function getDaysUntilEnd(endAt: Date | null): number | null {
  if (!endAt) return null;
  const now = new Date();
  const diffMs = endAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatSaleEnd(endAt: Date | null, t: Translation): string | null {
  const days = getDaysUntilEnd(endAt);
  if (days === null) return null;
  if (days <= 0) return t.today;
  return t.daysLeft.replace('{days}', String(days));
}

/**
 * 価格比較コンポーネント（サーバーサイドレンダリング対応）
 * 複数ASPの価格を比較表示
 */
export default function PriceComparisonServer({ sources, locale }: PriceComparisonServerProps) {
  const t = translations[locale as TranslationKey] || translations.ja;

  // Filter out sources without price
  const sourcesWithPrice = sources.filter(s => s.regularPrice !== null || s.salePrice !== null);

  if (sourcesWithPrice.length === 0) {
    return null;
  }

  const isMultiple = sourcesWithPrice.length >= 2;

  // Find cheapest price
  const cheapestSource = sourcesWithPrice[0]; // Already sorted by price
  const cheapestPrice = cheapestSource.salePrice ?? cheapestSource.regularPrice ?? 0;

  // Calculate max savings compared to highest price
  const highestPrice = Math.max(
    ...sourcesWithPrice.map(s => s.regularPrice ?? s.salePrice ?? 0)
  );
  const maxSavings = isMultiple ? highestPrice - cheapestPrice : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <Tag className="w-5 h-5 text-emerald-400" />
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
          const saleEndText = formatSaleEnd(source.saleEndAt, t);
          const daysLeft = getDaysUntilEnd(source.saleEndAt);
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
              className={`flex items-center gap-3 p-3 rounded-lg transition-all group ${
                isCheapest
                  ? 'bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-900/50'
                  : 'bg-gray-750 hover:bg-gray-700'
              }`}
            >
              {/* Provider badge */}
              <div
                className="px-2 py-1 rounded text-xs font-bold shrink-0 text-white"
                style={meta?.gradientColors
                  ? { background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})` }
                  : { backgroundColor: '#4b5563' }
                }
              >
                {meta?.label || source.aspName}
              </div>

              {/* Price info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {source.isOnSale && source.salePrice ? (
                    <>
                      <span className="text-lg font-bold text-rose-400">
                        ¥{source.salePrice.toLocaleString()}
                      </span>
                      {source.regularPrice && (
                        <span className="text-sm text-gray-500 line-through">
                          ¥{source.regularPrice.toLocaleString()}
                        </span>
                      )}
                      {source.discountPercent && (
                        <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
                          -{source.discountPercent}% {t.discount}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-lg font-bold text-white">
                      {source.regularPrice ? (
                        <>
                          {source.isSubscription && (
                            <span className="text-xs text-gray-400 mr-1">{t.subscription}</span>
                          )}
                          ¥{source.regularPrice.toLocaleString()}
                        </>
                      ) : (
                        <span className="text-gray-500 text-sm">{t.noPrice}</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Sale end info */}
                {source.isOnSale && saleEndText && (
                  <div className={`text-xs flex items-center gap-1 mt-1 ${
                    isUrgent ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {t.saleEnds}: {saleEndText}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                {isMultiple && isCheapest && (
                  <span className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded">
                    <Crown className="w-3 h-3" />
                    {t.cheapest}
                  </span>
                )}
                {source.isOnSale && !(isMultiple && isCheapest) && (
                  <span className="flex items-center gap-1 text-xs bg-rose-600 text-white px-2 py-1 rounded">
                    <TrendingDown className="w-3 h-3" />
                    {t.sale}
                  </span>
                )}
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
