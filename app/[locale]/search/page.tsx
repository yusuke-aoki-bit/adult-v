'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types/product';

interface Actress {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl?: string;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const { locale } = useParams();
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'products'; // 'products' or 'actresses'

  const [products, setProducts] = useState<Product[]>([]);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        if (type === 'products') {
          const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=50`);
          if (!response.ok) throw new Error('Failed to fetch products');
          const data = await response.json();
          setProducts(data.products || []);
        } else if (type === 'actresses') {
          // 女優検索のAPI（既存のホームページと同じ）
          const response = await fetch(`/api/actresses?q=${encodeURIComponent(query)}&limit=50`);
          if (!response.ok) throw new Error('Failed to fetch actresses');
          const data = await response.json();
          setActresses(data.actresses || []);
        }
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('検索中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, type]);

  if (!query) {
    return (
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-400">
            <p>検索キーワードを入力してください</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-red-400">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // 商品検索結果
  if (type === 'products') {
    return (
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            作品検索結果: {query}
          </h1>
          <p className="text-gray-300">
            {products.length > 0 ? `${products.length}件の作品が見つかりました` : '検索結果がありません'}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>一致する作品が見つかりませんでした</p>
            <p className="mt-2">別のキーワードで検索してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/${locale}/products/${product.id}`}
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
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-pink-400 transition-colors">
                    {product.title}
                  </h3>
                  {product.actressName && (
                    <p className="text-xs text-gray-300 mt-1">{product.actressName}</p>
                  )}
                  {product.normalizedProductId && (
                    <p className="text-xs text-gray-400 mt-1">{product.normalizedProductId}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </div>
    );
  }

  // 女優検索結果
  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          女優検索結果: {query}
        </h1>
        <p className="text-gray-300">
          {actresses.length > 0 ? `${actresses.length}人の女優が見つかりました` : '検索結果がありません'}
        </p>
      </div>

      {actresses.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <p>一致する女優が見つかりませんでした</p>
          <p className="mt-2">別のキーワードで検索してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {actresses.map((actress) => (
            <Link
              key={actress.id}
              href={`/${locale}/actress/${actress.id}`}
              className="group block bg-gray-900 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="relative aspect-[3/4] w-full bg-gray-800">
                {actress.thumbnailUrl ? (
                  <Image
                    src={actress.thumbnailUrl}
                    alt={actress.name}
                    fill
                    className="object-cover opacity-90"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-750">
                    <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs">画像なし</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="text-sm font-semibold truncate group-hover:text-pink-300 transition-colors">
                    {actress.name}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
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
