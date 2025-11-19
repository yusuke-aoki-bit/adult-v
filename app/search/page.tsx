'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import ActressCard from '@/components/ActressCard';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import type { Product, Actress } from '@/types/product';

const PER_PAGE = 24;

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all'; // all, products, actresses
  const page = parseInt(searchParams.get('page') || '1', 10);
  const sort = searchParams.get('sort') || 'releaseDateDesc';
  const provider = searchParams.get('provider') || 'all';
  const priceRange = searchParams.get('priceRange') || 'all';

  const [products, setProducts] = useState<Product[]>([]);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [loading, setLoading] = useState(true);
  const [productTotal, setProductTotal] = useState(0);
  const [actressTotal, setActressTotal] = useState(0);

  useEffect(() => {
    async function performSearch() {
      if (!query.trim()) {
        setProducts([]);
        setActresses([]);
        setProductTotal(0);
        setActressTotal(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const searchQuery = query.trim();

        // 価格範囲の解析
        let minPrice: string | undefined;
        let maxPrice: string | undefined;
        if (priceRange && priceRange !== 'all') {
          if (priceRange === '3000') {
            minPrice = '3000';
          } else {
            const [min, max] = priceRange.split('-');
            minPrice = min;
            maxPrice = max;
          }
        }

        // 作品検索のURLパラメータを構築
        const productParams = new URLSearchParams({
          query: searchQuery,
          limit: '1000',
          sort,
        });
        if (provider !== 'all') {
          productParams.set('provider', provider);
        }
        if (minPrice !== undefined) {
          productParams.set('minPrice', minPrice);
        }
        if (maxPrice !== undefined) {
          productParams.set('maxPrice', maxPrice);
        }

        // 作品と女優を並列検索
        const [productResults, actressResults] = await Promise.all([
          fetch(`/api/products?${productParams.toString()}`)
            .then((res) => res.json())
            .then((data) => data.products || [])
            .catch(() => []),
          fetch(`/api/actresses?query=${encodeURIComponent(searchQuery)}&limit=1000`)
            .then((res) => res.json())
            .then((data) => data.actresses || [])
            .catch(() => []),
        ]);

        setProductTotal(productResults.length);
        setActressTotal(actressResults.length);

        // ページネーション
        if (type === 'all' || type === 'products') {
          const start = (page - 1) * PER_PAGE;
          const end = start + PER_PAGE;
          setProducts(productResults.slice(start, end));
        } else {
          setProducts([]);
        }

        if (type === 'all' || type === 'actresses') {
          const start = type === 'all' ? (page - 1) * PER_PAGE : (page - 1) * PER_PAGE;
          const end = start + PER_PAGE;
          setActresses(actressResults.slice(start, end));
        } else {
          setActresses([]);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [query, type, page, sort, provider, priceRange]);

  const totalResults = productTotal + actressTotal;
  const showProducts = type === 'all' || type === 'products';
  const showActresses = type === 'all' || type === 'actresses';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="h-72 bg-gray-200"></div>
                  <div className="p-6 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-6 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-8">
        {/* ヘッダー */}
        <section className="bg-gray-900 text-white rounded-3xl p-10 shadow-2xl">
          <h1 className="text-4xl font-bold mb-4">検索結果</h1>
          {query ? (
            <p className="text-white/80 text-lg">
              「<span className="font-semibold">{query}</span>」の検索結果: {totalResults}件
            </p>
          ) : (
            <p className="text-white/80">検索キーワードを入力してください</p>
          )}
        </section>

        {!query ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold mb-2">検索キーワードを入力</h2>
            <p className="text-gray-600 mb-6">作品名、女優名で検索できます</p>
            <Link
              href="/"
              className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        ) : totalResults === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold mb-2">検索結果が見つかりませんでした</h2>
            <p className="text-gray-600 mb-6">
              「{query}」に一致する作品・女優が見つかりませんでした
            </p>
            <Link
              href="/"
              className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        ) : (
          <>
            {/* タイプフィルター */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Link
                href={`/search?q=${encodeURIComponent(query)}&type=all${sort !== 'releaseDateDesc' ? `&sort=${sort}` : ''}${provider !== 'all' ? `&provider=${provider}` : ''}${priceRange !== 'all' ? `&priceRange=${priceRange}` : ''}`}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  type === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                すべて ({totalResults})
              </Link>
              <Link
                href={`/search?q=${encodeURIComponent(query)}&type=products${sort !== 'releaseDateDesc' ? `&sort=${sort}` : ''}${provider !== 'all' ? `&provider=${provider}` : ''}${priceRange !== 'all' ? `&priceRange=${priceRange}` : ''}`}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  type === 'products'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                作品 ({productTotal})
              </Link>
              <Link
                href={`/search?q=${encodeURIComponent(query)}&type=actresses`}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  type === 'actresses'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                女優 ({actressTotal})
              </Link>
            </div>

            {/* ソート・フィルター（作品のみ） */}
            {showProducts && (
              <FilterSortBar
                defaultSort="releaseDateDesc"
                showProviderFilter={true}
                showPriceFilter={true}
              />
            )}

            {/* 作品結果 */}
            {showProducts && products.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  作品 ({productTotal}件)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {productTotal > PER_PAGE && type === 'products' && (
                  <Pagination
                    total={productTotal}
                    page={page}
                    perPage={PER_PAGE}
                    basePath="/search"
                    queryParams={{ q: query, type: 'products' }}
                  />
                )}
              </section>
            )}

            {/* 女優結果 */}
            {showActresses && actresses.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  女優 ({actressTotal}件)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {actresses.map((actress) => (
                    <Link key={actress.id} href={`/actress/${actress.id}`} className="block">
                      <ActressCard actress={actress} compact />
                    </Link>
                  ))}
                </div>
                {actressTotal > PER_PAGE && type === 'actresses' && (
                  <Pagination
                    total={actressTotal}
                    page={page}
                    perPage={PER_PAGE}
                    basePath="/search"
                    queryParams={{ q: query, type: 'actresses' }}
                  />
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="container mx-auto px-4">
            <div className="animate-pulse space-y-8">
              <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
            </div>
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

