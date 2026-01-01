'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  Check,
  Clock,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { useBudget, useWatchlistAnalysis } from '@/hooks';
import type { EnrichedProduct } from '@adult-v/shared/hooks';
import BudgetManager from '@/components/BudgetManager';
import { localizedHref } from '@adult-v/shared/i18n';

const translations = {
  ja: {
    title: '予算管理',
    description: '月間予算を設定し、賢く購入しましょう',
    watchlist: 'ウォッチリスト',
    empty: 'ウォッチリストに作品を追加してください',
    browseProducts: '作品を探す',
    purchasePlan: '購入計画',
    priority: '優先順位',
    saleSoon: 'セール終了間近',
    onSale: 'セール中',
    regular: '通常価格',
    waitForSale: 'セール待ち',
    total: '合計',
    withinBudget: '予算内',
    overBudget: '予算超過',
    daysLeft: '日後終了',
    today: '本日まで',
    tomorrow: '明日まで',
    stats: '統計',
    onSaleCount: 'セール中',
    potentialSavings: '割引額',
    urgentItems: '今すぐ買うべき',
    canWait: '待てる作品',
    items: '件',
    viewDetails: '詳細を見る',
  },
  en: {
    title: 'Budget Manager',
    description: 'Set your monthly budget and shop smart',
    watchlist: 'Watchlist',
    empty: 'Add products to your watchlist',
    browseProducts: 'Browse Products',
    purchasePlan: 'Purchase Plan',
    priority: 'Priority',
    saleSoon: 'Sale ending soon',
    onSale: 'On Sale',
    regular: 'Regular Price',
    waitForSale: 'Wait for Sale',
    total: 'Total',
    withinBudget: 'Within Budget',
    overBudget: 'Over Budget',
    daysLeft: 'days left',
    today: 'Today only',
    tomorrow: 'Until tomorrow',
    stats: 'Statistics',
    onSaleCount: 'On Sale',
    potentialSavings: 'Savings',
    urgentItems: 'Buy Now',
    canWait: 'Can Wait',
    items: 'items',
    viewDetails: 'View Details',
  },
  zh: {
    title: '预算管理',
    description: '设置月度预算，聪明购物',
    watchlist: '关注列表',
    empty: '请将作品添加到关注列表',
    browseProducts: '浏览作品',
    purchasePlan: '购买计划',
    priority: '优先级',
    saleSoon: '促销即将结束',
    onSale: '促销中',
    regular: '原价',
    waitForSale: '等待促销',
    total: '合计',
    withinBudget: '预算内',
    overBudget: '超出预算',
    daysLeft: '天后结束',
    today: '仅限今天',
    tomorrow: '截止明天',
    stats: '统计',
    onSaleCount: '促销中',
    potentialSavings: '节省',
    urgentItems: '立即购买',
    canWait: '可等待',
    items: '件',
    viewDetails: '查看详情',
  },
  ko: {
    title: '예산 관리',
    description: '월간 예산을 설정하고 현명하게 구매하세요',
    watchlist: '관심 목록',
    empty: '관심 목록에 작품을 추가하세요',
    browseProducts: '작품 찾기',
    purchasePlan: '구매 계획',
    priority: '우선순위',
    saleSoon: '세일 종료 임박',
    onSale: '세일 중',
    regular: '정가',
    waitForSale: '세일 대기',
    total: '합계',
    withinBudget: '예산 내',
    overBudget: '예산 초과',
    daysLeft: '일 남음',
    today: '오늘까지',
    tomorrow: '내일까지',
    stats: '통계',
    onSaleCount: '세일 중',
    potentialSavings: '할인액',
    urgentItems: '지금 구매',
    canWait: '대기 가능',
    items: '개',
    viewDetails: '상세 보기',
  },
} as const;

type TranslationKey = keyof typeof translations;

type PriorityCategory = 'urgent' | 'onSale' | 'regular' | 'waitForSale';

function categorizeProduct(product: EnrichedProduct): PriorityCategory {
  if (product.saleEndDate) {
    const end = new Date(product.saleEndDate);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) return 'urgent';
    if (diffDays <= 7) return 'onSale';
  }
  if (product.salePrice) return 'onSale';
  // If product has been on sale before, might be worth waiting
  if (product.discount && product.discount > 0) return 'waitForSale';
  return 'regular';
}

export default function BudgetPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as TranslationKey] || translations.ja;

  const { remaining } = useBudget();
  const { products, stats, isLoading } = useWatchlistAnalysis();

  // Categorize and sort products
  const categorizedProducts = useMemo(() => {
    const categories: Record<PriorityCategory, EnrichedProduct[]> = {
      urgent: [],
      onSale: [],
      regular: [],
      waitForSale: [],
    };

    products.forEach((product) => {
      const category = categorizeProduct(product);
      categories[category].push(product);
    });

    // Sort urgent by end date
    categories.urgent.sort((a, b) => {
      const dateA = a.saleEndDate ? new Date(a.saleEndDate).getTime() : Infinity;
      const dateB = b.saleEndDate ? new Date(b.saleEndDate).getTime() : Infinity;
      return dateA - dateB;
    });

    // Sort on sale by discount
    categories.onSale.sort((a, b) => (b.discount || 0) - (a.discount || 0));

    return categories;
  }, [products]);

  const _getPriorityLabel = (category: PriorityCategory) => {
    switch (category) {
      case 'urgent':
        return t.saleSoon;
      case 'onSale':
        return t.onSale;
      case 'regular':
        return t.regular;
      case 'waitForSale':
        return t.waitForSale;
    }
  };

  const getPriorityColor = (category: PriorityCategory) => {
    switch (category) {
      case 'urgent':
        return 'bg-red-900 text-red-300 border-red-700';
      case 'onSale':
        return 'bg-green-900 text-green-300 border-green-700';
      case 'regular':
        return 'bg-gray-700 text-gray-300 border-gray-600';
      case 'waitForSale':
        return 'bg-yellow-900 text-yellow-300 border-yellow-700';
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return t.today;
    if (diffDays === 1) return t.tomorrow;
    return `${diffDays}${t.daysLeft}`;
  };

  return (
    <div className="min-h-screen theme-body">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-blue-400" />
            {t.title}
          </h1>
          <p className="text-gray-400 mt-2">{t.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Budget Manager */}
          <div className="lg:col-span-1">
            <BudgetManager
              locale={locale}
              showRecommendations={true}
              watchlistTotal={stats.totalSalePrice}
            />

            {/* Stats */}
            {products.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 mt-4">
                <h3 className="font-semibold text-white mb-3">{t.stats}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.onSaleCount}</span>
                    <span className="text-green-400">
                      {stats.onSaleCount} {t.items}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.potentialSavings}</span>
                    <span className="text-green-400">
                      ¥{stats.totalSavings.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.urgentItems}</span>
                    <span className="text-red-400">
                      {stats.urgentCount} {t.items}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Purchase Plan */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-400" />
                {t.purchasePlan}
              </h2>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-600 mx-auto" />
                  <p className="text-gray-400 mt-4">{t.empty}</p>
                  <Link
                    href={localizedHref('/products', locale)}
                    className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                  >
                    {t.browseProducts}
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Urgent Items */}
                  {categorizedProducts.urgent.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {t.saleSoon} ({categorizedProducts.urgent.length})
                      </h3>
                      <div className="space-y-2">
                        {categorizedProducts.urgent.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            locale={locale}
                            category="urgent"
                            getPriorityColor={getPriorityColor}
                            getDaysRemaining={getDaysRemaining}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* On Sale Items */}
                  {categorizedProducts.onSale.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" />
                        {t.onSale} ({categorizedProducts.onSale.length})
                      </h3>
                      <div className="space-y-2">
                        {categorizedProducts.onSale.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            locale={locale}
                            category="onSale"
                            getPriorityColor={getPriorityColor}
                            getDaysRemaining={getDaysRemaining}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regular Items */}
                  {categorizedProducts.regular.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">
                        {t.regular} ({categorizedProducts.regular.length})
                      </h3>
                      <div className="space-y-2">
                        {categorizedProducts.regular.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            locale={locale}
                            category="regular"
                            getPriorityColor={getPriorityColor}
                            getDaysRemaining={getDaysRemaining}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wait for Sale */}
                  {categorizedProducts.waitForSale.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {t.waitForSale} ({categorizedProducts.waitForSale.length})
                      </h3>
                      <div className="space-y-2">
                        {categorizedProducts.waitForSale.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            locale={locale}
                            category="waitForSale"
                            getPriorityColor={getPriorityColor}
                            getDaysRemaining={getDaysRemaining}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{t.total}</span>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">
                          ¥{stats.totalSalePrice.toLocaleString()}
                        </p>
                        {stats.totalSavings > 0 && (
                          <p className="text-sm text-green-400">
                            -{stats.totalSavings.toLocaleString()} ({t.potentialSavings})
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {stats.totalSalePrice <= remaining ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-green-400">{t.withinBudget}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400">
                            {t.overBudget} (¥{(stats.totalSalePrice - remaining).toLocaleString()})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Product Row Component
function ProductRow({
  product,
  locale,
  category,
  getPriorityColor: _getPriorityColor,
  getDaysRemaining,
  t: _t,
}: {
  product: EnrichedProduct;
  locale: string;
  category: PriorityCategory;
  getPriorityColor: (c: PriorityCategory) => string;
  getDaysRemaining: (d: string) => string;
  t: (typeof translations)[TranslationKey];
}) {
  const effectivePrice = product.salePrice || product.price || 0;

  return (
    <Link
      href={localizedHref(`/products/${product.id}`, locale)}
      className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-12 h-16 relative rounded overflow-hidden bg-gray-600 shrink-0">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.title || ''}
            fill
            className="object-cover"
          />
        ) : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm line-clamp-1">{product.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {product.saleEndDate && category === 'urgent' && (
            <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">
              {getDaysRemaining(product.saleEndDate)}
            </span>
          )}
          {product.discount && product.discount > 0 && (
            <span className="text-xs text-green-400">-{product.discount}%</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="text-white font-semibold">¥{effectivePrice.toLocaleString()}</p>
        {product.salePrice && product.price && product.salePrice < product.price && (
          <p className="text-xs text-gray-500 line-through">
            ¥{product.price.toLocaleString()}
          </p>
        )}
      </div>
    </Link>
  );
}
