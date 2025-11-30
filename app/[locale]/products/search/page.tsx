'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Filter, Video, ImageIcon } from 'lucide-react';
import type { Product } from '@/types/product';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = searchParams.get('q');
  const hasVideoParam = searchParams.get('hasVideo') === 'true';
  const hasImageParam = searchParams.get('hasImage') === 'true';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(hasVideoParam);
  const [hasImage, setHasImage] = useState(hasImageParam);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // URLパラメータを更新する関数
  const updateFilters = useCallback((newHasVideo: boolean, newHasImage: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newHasVideo) {
      params.set('hasVideo', 'true');
    } else {
      params.delete('hasVideo');
    }
    if (newHasImage) {
      params.set('hasImage', 'true');
    } else {
      params.delete('hasImage');
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        let url = `/api/products/search?q=${encodeURIComponent(query)}&limit=50`;
        if (hasVideo) url += '&hasVideo=true';
        if (hasImage) url += '&hasImage=true';
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('商品の検索中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [query, hasVideo, hasImage]);

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-400">
          <p>検索キーワードを入力してください</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-300">検索中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const activeFilterCount = (hasVideo ? 1 : 0) + (hasImage ? 1 : 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          検索結果: {query}
        </h1>
        <p className="text-gray-300">
          {products.length > 0 ? `${products.length}件の商品が見つかりました` : '検索結果がありません'}
        </p>
      </div>

      {/* フィルターセクション */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center gap-2 text-white hover:text-rose-500 transition-colors w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <span className="font-medium">
              フィルター
              {activeFilterCount > 0 && (
                <span className="ml-2 bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isFilterOpen && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
            <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={hasVideo}
                onChange={(e) => {
                  setHasVideo(e.target.checked);
                  updateFilters(e.target.checked, hasImage);
                }}
                className="w-5 h-5 text-rose-600 bg-gray-700 border-gray-600 rounded focus:ring-rose-500"
              />
              <Video className="w-5 h-5 text-rose-500" />
              <span>サンプル動画あり</span>
            </label>

            <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={(e) => {
                  setHasImage(e.target.checked);
                  updateFilters(hasVideo, e.target.checked);
                }}
                className="w-5 h-5 text-rose-600 bg-gray-700 border-gray-600 rounded focus:ring-rose-500"
              />
              <ImageIcon className="w-5 h-5 text-blue-500" />
              <span>サンプル画像あり</span>
            </label>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setHasVideo(false);
                  setHasImage(false);
                  updateFilters(false, false);
                }}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mt-2"
              >
                フィルターをクリア
              </button>
            )}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <p>一致する商品が見つかりませんでした</p>
          <p className="mt-2">別のキーワードで検索してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/ja/products/${product.normalizedProductId || product.id}`}
              className="group block bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="relative aspect-[3/4] w-full bg-gray-700">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-750">
                    <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">画像なし</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-rose-600 transition-colors">
                  {product.title}
                </h3>
                {product.actressName && (
                  <p className="text-xs text-gray-300 mt-1">{product.actressName}</p>
                )}
                {product.price && (
                  <p className="text-sm font-bold text-rose-600 mt-2">
                    ¥{product.price.toLocaleString()}
                  </p>
                )}
                {product.providerLabel && (
                  <p className="text-xs text-gray-400 mt-1">{product.providerLabel}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          </div>
        </div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
