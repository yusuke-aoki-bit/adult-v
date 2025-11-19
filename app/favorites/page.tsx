'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import { getFavorites } from '@/lib/favorites';
import type { Product } from '@/types/product';

const PER_PAGE = 24;

function FavoritesContent() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // お気に入りIDリストを更新
    const updateFavorites = () => {
      setFavoriteIds(getFavorites());
    };

    updateFavorites();
    window.addEventListener('favorites-updated', updateFavorites);

    return () => {
      window.removeEventListener('favorites-updated', updateFavorites);
    };
  }, []);

  useEffect(() => {
    async function loadFavorites() {
      if (favoriteIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // お気に入り作品を取得（APIから複数のIDで取得）
        const productsList = await Promise.all(
          favoriteIds.map((id) =>
            fetch(`/api/products/${id}`)
              .then((res) => res.json())
              .then((data) => data.product)
              .catch(() => null)
          )
        );

        const validProducts = productsList.filter(
          (p): p is Product => p !== null
        );

        // お気に入り順序を保持
        const sortedProducts = favoriteIds
          .map((id) => validProducts.find((p) => p.id === id))
          .filter((p): p is Product => p !== undefined);

        setProducts(sortedProducts);
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, [favoriteIds]);

  const total = products.length;
  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const paginatedProducts = products.slice(start, end);

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
          <h1 className="text-4xl font-bold mb-4">お気に入り作品</h1>
          <p className="text-white/80 text-lg">
            {total}件のお気に入り作品
          </p>
        </section>

        {total === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">❤️</div>
            <h2 className="text-2xl font-bold mb-2">お気に入り作品がありません</h2>
            <p className="text-gray-600 mb-6">
              作品のハートアイコンをクリックして、お気に入りに追加してください
            </p>
            <Link
              href="/"
              className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              作品を探す
            </Link>
          </div>
        ) : (
          <>
            {/* 作品一覧 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* ページネーション */}
            {total > PER_PAGE && (
              <Pagination
                total={total}
                page={page}
                perPage={PER_PAGE}
                basePath="/favorites"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FavoritesPage() {
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
      <FavoritesContent />
    </Suspense>
  );
}

