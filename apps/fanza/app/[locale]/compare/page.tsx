'use client';

import { useState, useCallback, useEffect, Suspense, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCompare, HomeSectionManager } from '@adult-v/shared/components';
import { useCompareList } from '@adult-v/shared/hooks';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';

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

interface ComparePageClientProps {
  locale: string;
}

function ComparePageClient({ locale }: ComparePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { removeItem, clearAll } = useCompareList();

  // URLパラメータから初期値を取得（searchParamsが変わっても初期値は変更しない）
  const [productIds, setProductIds] = useState<string[]>(() => {
    const idsParam = searchParams.get('ids');
    return idsParam ? idsParam.split(',').slice(0, 4) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    title: string;
    imageUrl: string | null;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // URLを更新
  useEffect(() => {
    if (productIds.length > 0) {
      const newUrl = `/${locale}/compare?ids=${productIds.join(',')}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [productIds, locale]);

  const handleProductClick = useCallback((productId: string) => {
    router.push(`/${locale}/products/${productId}`);
  }, [router, locale]);

  const handleRemoveProduct = useCallback((productId: string) => {
    setProductIds(prev => prev.filter(id => id !== productId));
    // localStorageの比較リストからも削除
    removeItem(productId);
  }, [removeItem]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.products?.map((p: { normalizedProductId: string; title: string; defaultThumbnailUrl: string | null }) => ({
          id: p.normalizedProductId,
          title: p.title,
          imageUrl: p.defaultThumbnailUrl,
        })) || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleAddProduct = useCallback((productId: string) => {
    if (productIds.length >= 4) return;
    if (productIds.includes(productId)) return;
    setProductIds(prev => [...prev, productId]);
    setSearchQuery('');
    setSearchResults([]);
  }, [productIds]);

  return (
    <div className="theme-body min-h-screen">
      {/* 上部セクション（セール中・最近見た作品） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="compare" />
        </div>
      </section>

      <main className="min-h-screen theme-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* ヘッダー */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-2">
              {locale === 'ja' ? '作品を比較' : 'Compare Products'}
            </h1>
            <p className="theme-text-secondary">
              {locale === 'ja'
                ? '最大4作品まで比較できます'
                : 'Compare up to 4 products'}
            </p>
          </div>

          {/* 作品追加セクション */}
          {productIds.length < 4 && (
            <div className="mb-6 p-4 rounded-lg bg-gray-100 border border-gray-200">
              <h2 className="font-semibold theme-text mb-3">
                {locale === 'ja' ? '作品を追加' : 'Add Product'}
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={locale === 'ja' ? '作品名や品番で検索...' : 'Search by title or ID...'}
                  className="flex-1 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSearching ? '...' : locale === 'ja' ? '検索' : 'Search'}
                </button>
              </div>

              {/* 検索結果 */}
              {searchResults.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddProduct(result.id)}
                      disabled={productIds.includes(result.id)}
                      className={`p-2 rounded-lg border transition-colors ${
                        productIds.includes(result.id)
                          ? 'border-gray-300 opacity-50 cursor-not-allowed'
                          : 'border-gray-300 hover:border-pink-500 hover:bg-gray-50'
                      }`}
                    >
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="w-full aspect-3/4 object-cover rounded mb-1"
                        />
                      ) : (
                        <div className="w-full aspect-3/4 bg-gray-200 rounded mb-1 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <p className="text-xs text-gray-900 line-clamp-2">{result.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 選択中の作品数 */}
          <div className="mb-4 flex items-center gap-2">
            <span className="theme-text-secondary text-sm">
              {locale === 'ja' ? '選択中:' : 'Selected:'}
            </span>
            <span className="px-2 py-1 bg-pink-600 text-white text-sm rounded">
              {productIds.length} / 4
            </span>
            {productIds.length > 0 && (
              <button
                onClick={() => {
                  setProductIds([]);
                  clearAll();
                }}
                className="text-sm text-red-500 hover:text-red-600"
              >
                {locale === 'ja' ? 'すべてクリア' : 'Clear All'}
              </button>
            )}
          </div>

          {/* 比較コンポーネント */}
          <ProductCompare
            productIds={productIds}
            locale={locale}
            theme="light"
            onProductClick={handleProductClick}
            onRemoveProduct={handleRemoveProduct}
          />

          {/* 使い方 */}
          <div className="mt-8 p-4 rounded-lg bg-gray-100 border border-gray-200">
            <h2 className="font-semibold theme-text mb-2">
              {locale === 'ja' ? '使い方' : 'How to use'}
            </h2>
            <ul className="text-sm theme-text-secondary space-y-1">
              <li>
                {locale === 'ja'
                  ? '1. 上の検索ボックスで比較したい作品を検索'
                  : '1. Search for products you want to compare'}
              </li>
              <li>
                {locale === 'ja'
                  ? '2. 検索結果から作品をクリックして追加（最大4件）'
                  : '2. Click on search results to add (up to 4)'}
              </li>
              <li>
                {locale === 'ja'
                  ? '3. 価格、再生時間、評価、出演者などを比較'
                  : '3. Compare price, duration, rating, performers, etc.'}
              </li>
            </ul>
            </div>
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
            pageId="compare"
          />
        </div>
      </section>

      {/* セクションカスタマイズ */}
      <div className="container mx-auto px-4 pb-8">
        <HomeSectionManager locale={locale} theme="light" pageId="compare" />
      </div>
    </div>
  );
}

export default function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

  return (
    <Suspense fallback={<ComparePageSkeleton />}>
      <ComparePageClient locale={locale} />
    </Suspense>
  );
}

// ローディング中のスケルトン
function ComparePageSkeleton() {
  return (
    <div className="theme-body min-h-screen">
      <main className="min-h-screen theme-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-600 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-3/4 bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
