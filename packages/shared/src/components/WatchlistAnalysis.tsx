'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingCart,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Film,
  Sparkles,
} from 'lucide-react';
import type { FavoriteItem } from '../hooks/useFavorites';
import { normalizeImageUrl } from '../lib/image-utils';
import { getTranslation, watchlistAnalysisTranslations } from '../lib/translations';

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

type Translation = {
  [K in keyof (typeof watchlistAnalysisTranslations)['ja']]: string;
};

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
  t: Translation,
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
  const t = getTranslation(watchlistAnalysisTranslations, locale);

  const analysis = useMemo(() => {
    const productsWithPrice = products.filter((p) => p.price !== undefined);

    // Calculate totals
    const totalRegularPrice = productsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalSalePrice = productsWithPrice.reduce((sum, p) => sum + (p.salePrice || p.price || 0), 0);
    const totalSavings = totalRegularPrice - totalSalePrice;

    // Count sale items
    const onSaleCount = products.filter((p) => p.salePrice).length;

    // Prioritize products
    const prioritizedProducts = products
      .map((p) => ({
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
    const urgentCount = prioritizedProducts.filter((p) => p.urgent).length;

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
      <div className="rounded-lg bg-gray-800 p-6 text-center">
        <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-gray-600" />
        <h3 className="mb-2 font-bold text-white">{t.noProducts}</h3>
        <p className="text-sm text-gray-400">{t.addProducts}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-800 p-4 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
        <Sparkles className="h-5 w-5 text-yellow-400" />
        {t.title}
      </h3>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white sm:text-2xl">{analysis.totalCount}</div>
          <div className="text-xs text-gray-400">{t.itemCount.replace('{count}', '')}</div>
        </div>

        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-emerald-400 sm:text-2xl">
            ¥{analysis.totalSalePrice.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">{t.totalValue}</div>
        </div>

        {analysis.onSaleCount > 0 && (
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-rose-400 sm:text-2xl">{analysis.onSaleCount}</div>
            <div className="text-xs text-gray-400">{t.onSale}</div>
          </div>
        )}

        {analysis.totalSavings > 0 && (
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-400 sm:text-2xl">
              ¥{analysis.totalSavings.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">{t.savings}</div>
          </div>
        )}
      </div>

      {/* Urgent Alert */}
      {analysis.urgentCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span className="text-sm text-red-300">{t.saleAlert}</span>
        </div>
      )}

      {/* Purchase Priority List */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-400">
          <Clock className="h-4 w-4" />
          {t.purchaseOrder}
        </h4>

        {analysis.prioritizedProducts.slice(0, 6).map((product) => (
          <Link
            key={`${product.type}-${product['id']}`}
            href={`/${locale}/products/${product['id']}`}
            className="bg-gray-750 group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-700"
          >
            {/* Thumbnail */}
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-gray-700 sm:h-[72px] sm:w-14">
              {product['thumbnail'] ? (
                <Image
                  src={normalizeImageUrl(product['thumbnail'])}
                  alt={product['title'] || ''}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="h-6 w-6 text-gray-600" />
                </div>
              )}
              {/* Priority badge */}
              <div
                className={`absolute top-0 left-0 flex h-5 w-5 items-center justify-center text-xs font-bold ${
                  product['priority'] === 1
                    ? 'bg-red-500 text-white'
                    : product['priority'] === 2
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-600 text-white'
                }`}
              >
                {product['priority']}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h5 className="line-clamp-1 text-sm font-medium text-white transition-colors group-hover:text-rose-300">
                {product['title']}
              </h5>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {product.salePrice ? (
                  <>
                    <span className="text-sm font-bold text-rose-400">¥{product.salePrice.toLocaleString()}</span>
                    {product['discount'] && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">
                        -{product['discount']}%
                      </span>
                    )}
                  </>
                ) : product['price'] ? (
                  <span className="text-sm text-gray-300">¥{product['price'].toLocaleString()}</span>
                ) : (
                  <span className="text-xs text-gray-500">{t.priceUnknown}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1">
                {product.urgent ? (
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                ) : product['priority'] === 1 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : product['priority'] === 2 ? (
                  <TrendingDown className="h-3 w-3 text-yellow-400" />
                ) : (
                  <Clock className="h-3 w-3 text-gray-500" />
                )}
                <span
                  className={`text-xs ${
                    product.urgent
                      ? 'text-red-400'
                      : product['priority'] === 1
                        ? 'text-green-400'
                        : product['priority'] === 2
                          ? 'text-yellow-400'
                          : 'text-gray-500'
                  }`}
                >
                  {product['reason']}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="text-gray-500 transition-colors group-hover:text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Budget Tip */}
      <div className="mt-4 border-t border-gray-700 pt-4">
        <p className="flex items-center gap-1 text-xs text-gray-500">
          <DollarSign className="h-3 w-3" />
          {t.budgetTip}
        </p>
      </div>
    </div>
  );
}
