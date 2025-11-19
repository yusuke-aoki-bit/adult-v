'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import FilterSortBar from '@/components/FilterSortBar';
// getFeaturedActresses is now fetched via API
import { categories, getCategoryName } from '@/lib/categories';
import type { ProductCategory, Product, Actress } from '@/types/product';
import Link from 'next/link';
import ActressCard from '@/components/ActressCard';

function CategoriesContent() {
  const searchParams = useSearchParams();
  const initialCategory = (searchParams.get('category') || 'all') as ProductCategory;
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(initialCategory);
  const [products, setProducts] = useState<Product[]>([]);
  const [highlightedActresses, setHighlightedActresses] = useState<Actress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // URLパラメータからソート・フィルター情報を取得
        const sort = searchParams.get('sort') || 'releaseDateDesc';
        const provider = searchParams.get('provider') || 'all';
        const priceRange = searchParams.get('priceRange') || 'all';

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

        // APIからデータを取得
        const params = new URLSearchParams({
          category: selectedCategory,
          limit: '1000',
          sort,
        });
        if (provider !== 'all') {
          params.set('provider', provider);
        }
        if (minPrice !== undefined) {
          params.set('minPrice', minPrice);
        }
        if (maxPrice !== undefined) {
          params.set('maxPrice', maxPrice);
        }

        const [productsRes, actressesRes] = await Promise.all([
          fetch(`/api/products?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => data.products || []),
          fetch('/api/actresses?featured=true&limit=3')
            .then((res) => res.json())
            .then((data) => data.actresses || []),
        ]);
        const actresses = actressesRes;

        setProducts(productsRes);
        setHighlightedActresses(actresses);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedCategory, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-10">
        {/* ページヘッダー */}
        <section className="bg-gray-900 text-white rounded-3xl p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">
            Genre Intelligence
          </p>
          <h1 className="text-4xl font-bold mt-4 mb-4">ジャンル別プレイブック</h1>
          <p className="text-white/70 max-w-3xl">
            王道・VR・マニアックまで、重視する体験から作品を逆引き。各ジャンルの推奨サービスと
            女優傾向を把握して、レビュー導線の回遊率を高めましょう。
          </p>
        </section>

        {/* カテゴリフィルター */}
        <section className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-xl font-semibold mb-4">ジャンルを選ぶ</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  selectedCategory === category.id
                    ? 'border-gray-900 bg-gray-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="text-3xl mb-1">{category.icon}</div>
                <div className="font-semibold text-sm">{category.name}</div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {category.description}
                </p>
                <p className="text-[11px] text-gray-400 mt-2">
                  推奨: {category.exampleServices.map((s) => s.toUpperCase()).join(' / ')}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* 商品一覧 */}
        <section>
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {getCategoryName(selectedCategory)}
            </p>
            <h2 className="text-3xl font-bold mt-2 text-gray-900">
              {products.length}件の作品が見つかりました
            </h2>
          </div>

          {/* フィルター・ソートバー */}
          <FilterSortBar
            defaultSort="releaseDateDesc"
            showProviderFilter={true}
            showPriceFilter={true}
          />

          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600">読み込み中...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">該当作品が見つかりません</h3>
              <p className="text-gray-600 mb-6">別ジャンルに切り替えてください</p>
              <Link
                href="/"
                className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                ホームに戻る
              </Link>
            </div>
          )}
        </section>

        {/* ハイライト女優 */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Actress Picks</p>
              <h3 className="text-2xl font-semibold text-gray-900">
                このジャンルで狙いたい主力女優
              </h3>
            </div>
            <Link
              href="/actresses"
              className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              女優図鑑へ →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {highlightedActresses.map((actress) => (
              <ActressCard key={actress.id} actress={actress} compact />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <CategoriesContent />
    </Suspense>
  );
}
