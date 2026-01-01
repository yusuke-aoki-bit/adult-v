'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface BundleProduct {
  id: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  salePrice?: number;
  releaseDate: string;
}

interface BundleData {
  totalProducts: number;
  products: BundleProduct[];
  totalRegularPrice: number;
  totalSalePrice: number;
  potentialSavings: number;
  onSaleCount: number;
}

interface ActressBundleCalculatorProps {
  actressId: number;
  actressName: string;
  locale?: string;
  theme?: 'dark' | 'light';
  productLinkPrefix?: string;
}

const TRANSLATIONS = {
  ja: {
    bundleCalculator: 'まとめ買いシミュレーター',
    description: 'この女優の全作品をまとめて購入した場合の概算金額',
    totalWorks: '全作品数',
    onSale: 'セール中',
    regularTotal: '通常価格合計',
    saleTotal: 'セール価格合計',
    savings: '割引額',
    viewAllWorks: '全作品を見る',
    loading: '計算中...',
    noData: 'データがありません',
    pieces: '作品',
  },
  en: {
    bundleCalculator: 'Bundle Calculator',
    description: 'Estimated total for all works by this actress',
    totalWorks: 'Total works',
    onSale: 'On sale',
    regularTotal: 'Regular price total',
    saleTotal: 'Sale price total',
    savings: 'Savings',
    viewAllWorks: 'View all works',
    loading: 'Calculating...',
    noData: 'No data available',
    pieces: 'works',
  },
  zh: {
    bundleCalculator: '批量购买计算器',
    description: '购买该女优全部作品的预估总价',
    totalWorks: '总作品数',
    onSale: '促销中',
    regularTotal: '原价总计',
    saleTotal: '促销价总计',
    savings: '节省金额',
    viewAllWorks: '查看全部作品',
    loading: '计算中...',
    noData: '暂无数据',
    pieces: '部作品',
  },
  ko: {
    bundleCalculator: '묶음 구매 계산기',
    description: '이 여배우의 전 작품을 구매할 경우 예상 총액',
    totalWorks: '총 작품 수',
    onSale: '세일 중',
    regularTotal: '정가 합계',
    saleTotal: '세일가 합계',
    savings: '절약 금액',
    viewAllWorks: '전체 작품 보기',
    loading: '계산 중...',
    noData: '데이터 없음',
    pieces: '작품',
  },
};

export default function ActressBundleCalculator({
  actressId,
  actressName,
  locale = 'ja',
  theme = 'dark',
  productLinkPrefix = '/products',
}: ActressBundleCalculatorProps) {
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;
  const isDark = theme === 'dark';

  useEffect(() => {
    async function fetchBundleData() {
      try {
        const response = await fetch(`/api/performers/${actressId}/bundle`);
        if (response.ok) {
          const data = await response.json();
          setBundleData(data);
        }
      } catch (error) {
        console.error('Failed to fetch bundle data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBundleData();
  }, [actressId]);

  const savingsPercent = useMemo(() => {
    if (!bundleData || bundleData.totalRegularPrice === 0) return 0;
    return Math.round((bundleData.potentialSavings / bundleData.totalRegularPrice) * 100);
  }, [bundleData]);

  if (loading) {
    return (
      <div className={`rounded-lg p-6 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} animate-pulse`}>
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!bundleData || bundleData.totalProducts === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg p-6 ${isDark ? 'bg-linear-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-700/30' : 'bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {t.bundleCalculator}
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`text-sm ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
        >
          {showDetails ? '閉じる' : '詳細を見る'}
        </button>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t.description}
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.totalWorks}</p>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {bundleData.totalProducts}<span className="text-sm ml-1">{t.pieces}</span>
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.onSale}</p>
          <p className={`text-xl font-bold ${bundleData.onSaleCount > 0 ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {bundleData.onSaleCount}<span className="text-sm ml-1">{t.pieces}</span>
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.regularTotal}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-gray-400 line-through' : 'text-gray-500 line-through'}`}>
            ¥{bundleData.totalRegularPrice.toLocaleString()}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-emerald-900/50' : 'bg-emerald-100'}`}>
          <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{t.saleTotal}</p>
          <p className={`text-xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            ¥{bundleData.totalSalePrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Savings Badge */}
      {bundleData.potentialSavings > 0 && (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-yellow-900/30 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${isDark ? 'bg-yellow-500 text-black' : 'bg-yellow-400 text-yellow-900'}`}>
            -{savingsPercent}%
          </div>
          <div>
            <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>{t.savings}</p>
            <p className={`font-bold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              ¥{bundleData.potentialSavings.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Product List (Expandable) */}
      {showDetails && bundleData.products.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {bundleData.products.slice(0, 12).map((product) => (
              <Link
                key={product.id}
                href={`${productLinkPrefix}/${product.normalizedProductId || product.id}`}
                className={`group p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-white'}`}
              >
                <div className="relative rounded overflow-hidden mb-1" style={{ aspectRatio: '3/4' }}>
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <span className="text-xs text-gray-500">No Image</span>
                    </div>
                  )}
                  {product.salePrice && product.salePrice < product.price && (
                    <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded">
                      SALE
                    </div>
                  )}
                </div>
                <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-300 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'}`}>
                  {product.title}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${product.salePrice ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  ¥{(product.salePrice || product.price).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
          {bundleData.products.length > 12 && (
            <p className={`text-center text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              +{bundleData.products.length - 12} {t.pieces}
            </p>
          )}
        </div>
      )}

      {/* View All Link */}
      <Link
        href={`/${locale}/actress/${actressId}`}
        className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
          isDark
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {t.viewAllWorks}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
