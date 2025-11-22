'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function SearchBar() {
  const [actressQuery, setActressQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'ja';

  const handleActressSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (actressQuery.trim()) {
      router.push(`/${locale}/?q=${encodeURIComponent(actressQuery.trim())}`);
      setActressQuery('');
    }
  };

  const handleProductSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = productQuery.trim();
    if (!query) return;

    setIsSearching(true);

    try {
      // まず商品ID/メーカー品番で検索
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(query)}`);

      if (response.ok) {
        const data = await response.json();
        if (data.product) {
          // 商品が見つかった場合、その商品ページに遷移
          router.push(`/${locale}/products/${data.product.id}`);
          setProductQuery('');
          setIsSearching(false);
          return;
        }
      }

      // 商品IDで見つからない場合は、作品名で検索
      router.push(`/${locale}/search?q=${encodeURIComponent(query)}&type=products`);
      setProductQuery('');
    } catch (error) {
      console.error('Search error:', error);
      // エラーの場合でも作品名検索にフォールバック
      router.push(`/${locale}/search?q=${encodeURIComponent(query)}&type=products`);
      setProductQuery('');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* 女優名検索 */}
      <form onSubmit={handleActressSearch} className="relative flex-1">
        <input
          type="text"
          value={actressQuery}
          onChange={(e) => setActressQuery(e.target.value)}
          placeholder="女優名で検索..."
          className="w-full px-4 py-2 pl-10 pr-4 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </form>

      {/* 作品検索（作品名・作品ID・メーカー品番） */}
      <form onSubmit={handleProductSearch} className="relative flex-1">
        <input
          type="text"
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
          placeholder="作品名・作品ID・メーカー品番で検索..."
          disabled={isSearching}
          className="w-full px-4 py-2 pl-10 pr-4 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm disabled:opacity-50"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          </div>
        )}
      </form>
    </div>
  );
}
