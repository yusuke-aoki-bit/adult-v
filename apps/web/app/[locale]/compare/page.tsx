'use client';

import { useState, useCallback, useEffect, Suspense, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCompare } from '@adult-v/shared/components';
import { useCompareList } from '@adult-v/shared/hooks';

const translations = {
  title: { ja: '作品を比較', en: 'Compare Products' },
  subtitle: { ja: '最大4作品まで比較できます', en: 'Compare up to 4 products' },
  addProduct: { ja: '作品を追加', en: 'Add Product' },
  searchPlaceholder: { ja: '作品名や品番で検索...', en: 'Search by title or ID...' },
  search: { ja: '検索', en: 'Search' },
  selected: { ja: '選択中:', en: 'Selected:' },
  clearAll: { ja: 'すべてクリア', en: 'Clear All' },
  howToUse: { ja: '使い方', en: 'How to use' },
  step1: { ja: '1. 上の検索ボックスで比較したい作品を検索', en: '1. Search for products you want to compare' },
  step2: { ja: '2. 検索結果から作品をクリックして追加（最大4件）', en: '2. Click on search results to add (up to 4)' },
  step3: { ja: '3. 価格、再生時間、評価、出演者などを比較', en: '3. Compare price, duration, rating, performers, etc.' },
} as const;

type TranslationKey = keyof typeof translations;

interface ComparePageClientProps {
  locale: string;
}

function ComparePageClient({ locale }: ComparePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { removeItem, clearAll } = useCompareList();

  const t = (key: TranslationKey) => translations[key][locale === 'ja' ? 'ja' : 'en'];

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

  // URLを更新（productIds が変わったときのみ）
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
      <main className="min-h-screen theme-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* ヘッダー */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-2">
                {t('title')}
              </h1>
              <p className="theme-text-secondary">
                {t('subtitle')}
              </p>
            </div>

          {/* 作品追加セクション */}
          {productIds.length < 4 && (
            <div className="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
              <h2 className="font-semibold theme-text mb-3">
                {t('addProduct')}
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('searchPlaceholder')}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSearching ? '...' : t('search')}
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
                          ? 'border-gray-600 opacity-50 cursor-not-allowed'
                          : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700'
                      }`}
                    >
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="w-full aspect-3/4 object-cover rounded mb-1"
                        />
                      ) : (
                        <div className="w-full aspect-3/4 bg-gray-600 rounded mb-1 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <p className="text-xs text-white line-clamp-2">{result.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 選択中の作品数 */}
          <div className="mb-4 flex items-center gap-2">
            <span className="theme-text-secondary text-sm">
              {t('selected')}
            </span>
            <span className="px-2 py-1 bg-blue-600 text-white text-sm rounded">
              {productIds.length} / 4
            </span>
            {productIds.length > 0 && (
              <button
                onClick={() => {
                  setProductIds([]);
                  clearAll();
                }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                {t('clearAll')}
              </button>
            )}
          </div>

          {/* 比較コンポーネント */}
          <ProductCompare
            productIds={productIds}
            locale={locale}
            theme="dark"
            onProductClick={handleProductClick}
            onRemoveProduct={handleRemoveProduct}
          />

          {/* 使い方 */}
          <div className="mt-8 p-4 rounded-lg bg-gray-800 border border-gray-700">
            <h2 className="font-semibold theme-text mb-2">
              {t('howToUse')}
            </h2>
            <ul className="text-sm theme-text-secondary space-y-1">
              <li>
                {t('step1')}
              </li>
              <li>
                {t('step2')}
              </li>
              <li>
                {t('step3')}
              </li>
            </ul>
            </div>
          </div>
        </div>
      </main>
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
