'use client';

import { useState, useCallback, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useWatchLater } from '@adult-v/shared/hooks';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import { PageSectionNav } from '@adult-v/shared/components';

const watchlistTexts = {
  ja: {
    loading: '読み込み中...',
    title: '後で見る',
    productsSaved: (n: number) => `${n}件の作品が保存されています`,
    newest: '新しい順',
    oldest: '古い順',
    confirmClearAll: 'すべて削除しますか？',
    clearAll: 'すべて削除',
    noProducts: 'まだ作品がありません',
    noProductsHint: '作品ページで「後で見る」ボタンを押すと、ここに保存されます',
    addedDate: '追加日:',
    view: '見る',
    remove: '削除',
  },
  en: {
    loading: 'Loading...',
    title: 'Watch Later',
    productsSaved: (n: number) => `${n} products saved`,
    newest: 'Newest',
    oldest: 'Oldest',
    confirmClearAll: 'Clear all items?',
    clearAll: 'Clear All',
    noProducts: 'No products yet',
    noProductsHint: 'Click "Watch Later" on product pages to save them here',
    addedDate: 'Added:',
    view: 'View',
    remove: 'Remove',
  },
} as const;

const localeMap: Record<string, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
  ko: 'ko-KR',
  'zh-TW': 'zh-TW',
};

function getWatchlistTexts(locale: string) {
  return locale in watchlistTexts
    ? watchlistTexts[locale as keyof typeof watchlistTexts]
    : watchlistTexts.en;
}

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

interface WatchlistPageClientProps {
  locale: string;
}

function WatchlistPageClient({ locale }: WatchlistPageClientProps) {
  const router = useRouter();
  const { items, isLoaded, removeItem, clearAll, count } = useWatchLater();
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const t = getWatchlistTexts(locale);

  // PageLayout用のデータ
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    fetch('/api/products/on-sale?limit=24&minDiscount=30')
      .then(res => res.json())
      .then(data => setSaleProducts(data.products || []))
      .catch(() => {});

    fetch('/api/products/uncategorized-count')
      .then(res => res.json())
      .then(data => setUncategorizedCount(data.count || 0))
      .catch(() => {});
  }, []);

  const layoutTranslations = {
    viewProductList: '作品一覧',
    viewProductListDesc: 'FANZAの全作品を検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'newest') {
      return b.addedAt - a.addedAt;
    }
    return a.addedAt - b.addedAt;
  });

  const handleProductClick = useCallback((id: string | number) => {
    router.push(`/${locale}/products/${id}`);
  }, [router, locale]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(localeMap[locale] || localeMap.en, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen theme-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5 theme-text" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="theme-text">
              {t.loading}
            </span>
          </div>
        </div>
      </main>
    );
  }

  // セクションナビゲーション用の翻訳
  const sectionLabels: Record<string, Record<string, string>> = {
    ja: { watchlist: '後で見る' },
    en: { watchlist: 'Watch Later' },
    zh: { watchlist: '稍后观看' },
    ko: { watchlist: '나중에 보기' },
  };

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション */}
      <PageSectionNav
        locale={locale}
        config={{
          hasSale: saleProducts.length > 0,
          hasRecentlyViewed: true,
          mainSectionId: 'watchlist',
          mainSectionLabel: sectionLabels[locale]?.watchlist || sectionLabels.ja.watchlist,
          hasRecommendations: true,
          hasWeeklyHighlights: true,
          hasTrending: true,
          hasAllProducts: true,
        }}
        theme="light"
        pageId="watchlist"
      />

      {/* 上部セクション（セール中・最近見た作品） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="watchlist" />
        </div>
      </section>

      <main id="watchlist" className="min-h-screen theme-bg scroll-mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* ヘッダー */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-1 flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t.title}
              </h1>
              <p className="theme-text-secondary">
                {t.productsSaved(count)}
              </p>
            </div>

            {count > 0 && (
              <div className="flex items-center gap-3">
                {/* ソート */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                  className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-pink-500"
                >
                  <option value="newest">{t.newest}</option>
                  <option value="oldest">{t.oldest}</option>
                </select>

                {/* クリアボタン */}
                <button
                  onClick={() => {
                    if (confirm(t.confirmClearAll)) {
                      clearAll();
                    }
                  }}
                  className="px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {t.clearAll}
                </button>
              </div>
            )}
          </div>

          {/* リスト */}
          {count === 0 ? (
            <div className="text-center py-16 bg-gray-100 rounded-lg border border-gray-200">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="theme-text-secondary text-lg mb-2">
                {t.noProducts}
              </p>
              <p className="theme-text-muted text-sm">
                {t.noProductsHint}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {/* サムネイル */}
                  <div
                    className="w-20 sm:w-24 shrink-0 cursor-pointer"
                    onClick={() => handleProductClick(item.productId)}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full aspect-3/4 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full aspect-3/4 bg-gray-200 rounded flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium theme-text line-clamp-2 cursor-pointer hover:text-pink-600 transition-colors"
                      onClick={() => handleProductClick(item.productId)}
                    >
                      {item.title}
                    </h3>
                    <p className="text-sm theme-text-muted mt-1">
                      {t.addedDate} {formatDate(item.addedAt)}
                    </p>
                    {item.provider && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {item.provider}
                      </span>
                    )}
                  </div>

                  {/* アクション */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleProductClick(item.productId)}
                      className="px-3 py-1.5 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded transition-colors"
                    >
                      {t.view}
                    </button>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      {t.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </main>

      {/* 下部セクション（おすすめ・注目・トレンド・リンク） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={false}
            translations={layoutTranslations}
            pageId="watchlist"
          />
        </div>
      </section>
    </div>
  );
}

export default function WatchlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

  return <WatchlistPageClient locale={locale} />;
}
