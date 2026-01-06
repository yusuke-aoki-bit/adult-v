'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, TrendingDown, Clock, AlertTriangle, CheckCircle2, DollarSign, Film, Sparkles } from 'lucide-react';
import type { FavoriteItem } from '../hooks/useFavorites';

interface ProductWithPrice extends FavoriteItem {
  price?: number | null;
  salePrice?: number | null;
  discount?: number | null;
  saleEndDate?: string | null;
  provider?: string | null;
}

interface WatchlistAnalysisProps {
  products: ProductWithPrice[];
  locale: string;
}

const translations = {
  ja: {
    title: 'ウォッチリスト分析',
    totalValue: '合計金額',
    itemCount: '{count}作品',
    onSale: 'セール中',
    regularPrice: '通常価格',
    savings: '節約可能',
    purchaseOrder: '購入優先順位',
    priority1: '今すぐ購入推奨',
    priority2: '検討中',
    priority3: 'セール待ち推奨',
    saleSoon: 'セール終了間近',
    daysLeft: 'あと{days}日',
    today: '本日まで',
    noProducts: 'お気に入りの作品がありません',
    addProducts: '作品をお気に入りに追加すると、ここで分析が表示されます',
    viewProduct: '詳細を見る',
    saleAlert: 'セール終了が近い作品があります',
    budgetTip: '予算に応じて購入を検討しましょう',
    onSaleNow: 'セール中',
    highDiscount: '大幅値下げ',
    priceUnknown: '価格情報なし',
  },
  en: {
    title: 'Watchlist Analysis',
    totalValue: 'Total Value',
    itemCount: '{count} products',
    onSale: 'On Sale',
    regularPrice: 'Regular Price',
    savings: 'Potential Savings',
    purchaseOrder: 'Purchase Priority',
    priority1: 'Buy Now',
    priority2: 'Consider',
    priority3: 'Wait for Sale',
    saleSoon: 'Sale Ending Soon',
    daysLeft: '{days} days left',
    today: 'Ends today',
    noProducts: 'No favorite products',
    addProducts: 'Add products to favorites to see analysis here',
    viewProduct: 'View Details',
    saleAlert: 'Some items have sales ending soon',
    budgetTip: 'Consider your budget when purchasing',
    onSaleNow: 'On Sale',
    highDiscount: 'Big Discount',
    priceUnknown: 'Price unknown',
  },
  zh: {
    title: '愿望清单分析',
    totalValue: '总金额',
    itemCount: '{count}部作品',
    onSale: '促销中',
    regularPrice: '原价',
    savings: '可节省',
    purchaseOrder: '购买优先级',
    priority1: '建议立即购买',
    priority2: '考虑中',
    priority3: '建议等待促销',
    saleSoon: '促销即将结束',
    daysLeft: '剩余{days}天',
    today: '今日截止',
    noProducts: '暂无收藏作品',
    addProducts: '添加收藏作品后，将在此显示分析',
    viewProduct: '查看详情',
    saleAlert: '部分商品促销即将结束',
    budgetTip: '根据预算合理购买',
    onSaleNow: '促销中',
    highDiscount: '大幅降价',
    priceUnknown: '价格未知',
  },
  ko: {
    title: '위시리스트 분석',
    totalValue: '총 금액',
    itemCount: '{count}개 작품',
    onSale: '세일 중',
    regularPrice: '정가',
    savings: '절약 가능',
    purchaseOrder: '구매 우선순위',
    priority1: '지금 구매 권장',
    priority2: '검토 중',
    priority3: '세일 대기 권장',
    saleSoon: '세일 마감 임박',
    daysLeft: '{days}일 남음',
    today: '오늘까지',
    noProducts: '찜한 작품이 없습니다',
    addProducts: '작품을 찜하면 여기에 분석이 표시됩니다',
    viewProduct: '상세 보기',
    saleAlert: '세일 마감이 임박한 상품이 있습니다',
    budgetTip: '예산에 맞게 구매를 검토하세요',
    onSaleNow: '세일 중',
    highDiscount: '대폭 할인',
    priceUnknown: '가격 정보 없음',
  },
} as const;

type Translations = typeof translations;
type TranslationKey = keyof Translations;
type Translation = Translations[TranslationKey];

function getDaysUntilSaleEnd(saleEndDate: string | null | undefined): number | null {
  if (!saleEndDate) return null;
  const end = new Date(saleEndDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getPurchasePriority(
  product: ProductWithPrice,
  t: Translation
): { priority: 1 | 2 | 3; reason: string; urgent: boolean } {
  const daysLeft = getDaysUntilSaleEnd(product.saleEndDate);

  // Priority 1: On sale and ending soon
  if (product.salePrice && daysLeft !== null && daysLeft <= 3) {
    return {
      priority: 1,
      reason: daysLeft === 0 ? t.today : t.daysLeft.replace('{days}', String(daysLeft)),
      urgent: true,
    };
  }

  // Priority 1: High discount (30%+)
  if (product['discount'] && product['discount'] >= 30) {
    return {
      priority: 1,
      reason: t.highDiscount,
      urgent: false,
    };
  }

  // Priority 2: Currently on sale
  if (product.salePrice) {
    return {
      priority: 2,
      reason: t.onSaleNow,
      urgent: false,
    };
  }

  // Priority 3: Not on sale
  return {
    priority: 3,
    reason: t.priority3,
    urgent: false,
  };
}

export default function WatchlistAnalysis({ products, locale }: WatchlistAnalysisProps) {
  const t = translations[locale as TranslationKey] || translations.ja;

  const analysis = useMemo(() => {
    const productsWithPrice = products.filter(p => p.price !== undefined);

    // Calculate totals
    const totalRegularPrice = productsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalSalePrice = productsWithPrice.reduce(
      (sum, p) => sum + (p.salePrice || p.price || 0), 0
    );
    const totalSavings = totalRegularPrice - totalSalePrice;

    // Count sale items
    const onSaleCount = products.filter(p => p.salePrice).length;

    // Prioritize products
    const prioritizedProducts = products
      .map(p => ({
        ...p,
        ...getPurchasePriority(p, t),
      }))
      .sort((a, b) => {
        // Sort by priority, then by urgency, then by discount
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return (b.discount || 0) - (a.discount || 0);
      });

    // Check for urgent items
    const urgentCount = prioritizedProducts.filter(p => p.urgent).length;

    return {
      totalCount: products.length,
      totalRegularPrice,
      totalSalePrice,
      totalSavings,
      onSaleCount,
      prioritizedProducts,
      urgentCount,
    };
  }, [products, t]);

  if (products.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-white font-bold mb-2">{t.noProducts}</h3>
        <p className="text-gray-400 text-sm">{t.addProducts}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        {t.title}
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">
            {analysis.totalCount}
          </div>
          <div className="text-xs text-gray-400">
            {t.itemCount.replace('{count}', '')}
          </div>
        </div>

        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-xl sm:text-2xl font-bold text-emerald-400">
            ¥{analysis.totalSalePrice.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">{t.totalValue}</div>
        </div>

        {analysis.onSaleCount > 0 && (
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-rose-400">
              {analysis.onSaleCount}
            </div>
            <div className="text-xs text-gray-400">{t.onSale}</div>
          </div>
        )}

        {analysis.totalSavings > 0 && (
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-400">
              ¥{analysis.totalSavings.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">{t.savings}</div>
          </div>
        )}
      </div>

      {/* Urgent Alert */}
      {analysis.urgentCount > 0 && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-red-300 text-sm">{t.saleAlert}</span>
        </div>
      )}

      {/* Purchase Priority List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t.purchaseOrder}
        </h4>

        {analysis.prioritizedProducts.slice(0, 6).map((product) => (
          <Link
            key={`${product.type}-${product['id']}`}
            href={`/${locale}/products/${product['id']}`}
            className="flex items-center gap-3 bg-gray-750 hover:bg-gray-700 rounded-lg p-2 transition-colors group"
          >
            {/* Thumbnail */}
            <div className="w-12 h-16 sm:w-14 sm:h-[72px] relative shrink-0 bg-gray-700 rounded overflow-hidden">
              {product['thumbnail'] ? (
                <Image
                  src={product['thumbnail']}
                  alt={product['title'] || ''}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Film className="w-6 h-6 text-gray-600" />
                </div>
              )}
              {/* Priority badge */}
              <div className={`absolute top-0 left-0 w-5 h-5 flex items-center justify-center text-xs font-bold ${
                product['priority'] === 1
                  ? 'bg-red-500 text-white'
                  : product['priority'] === 2
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-600 text-white'
              }`}>
                {product['priority']}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h5 className="text-white text-sm font-medium line-clamp-1 group-hover:text-rose-300 transition-colors">
                {product['title']}
              </h5>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {product.salePrice ? (
                  <>
                    <span className="text-rose-400 font-bold text-sm">
                      ¥{product.salePrice.toLocaleString()}
                    </span>
                    {product['discount'] && (
                      <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
                        -{product['discount']}%
                      </span>
                    )}
                  </>
                ) : product['price'] ? (
                  <span className="text-gray-300 text-sm">
                    ¥{product['price'].toLocaleString()}
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs">{t.priceUnknown}</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {product.urgent ? (
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                ) : product['priority'] === 1 ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : product['priority'] === 2 ? (
                  <TrendingDown className="w-3 h-3 text-yellow-400" />
                ) : (
                  <Clock className="w-3 h-3 text-gray-500" />
                )}
                <span className={`text-xs ${
                  product.urgent
                    ? 'text-red-400'
                    : product['priority'] === 1
                    ? 'text-green-400'
                    : product['priority'] === 2
                    ? 'text-yellow-400'
                    : 'text-gray-500'
                }`}>
                  {product['reason']}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="text-gray-500 group-hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Budget Tip */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {t.budgetTip}
        </p>
      </div>
    </div>
  );
}
