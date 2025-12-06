'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function SearchBar() {
  const [actressQuery, setActressQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'ja';

  // デバウンス用のタイマー
  const actressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 女優名検索（デバウンス付き）
  const executeActressSearch = useCallback((query: string) => {
    if (query.trim().length >= 2) {
      router.push(`/${locale}/?q=${encodeURIComponent(query.trim())}`);
    }
  }, [router, locale]);

  // 作品検索（デバウンス付き）
  const executeProductSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) return;

    setIsSearching(true);

    try {
      // まず商品ID/メーカー品番で検索
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(query.trim())}`);

      if (response.ok) {
        const data = await response.json();
        if (data.product) {
          router.push(`/${locale}/products/${data.product.id}`);
          setProductQuery('');
          setIsSearching(false);
          return;
        }
      }

      // 商品IDで見つからない場合は、作品名で検索
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}&type=products`);
    } catch (error) {
      console.error('Search error:', error);
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}&type=products`);
    } finally {
      setIsSearching(false);
    }
  }, [router, locale]);

  // 女優名入力時のハンドラ（デバウンス300ms）
  const handleActressChange = (value: string) => {
    setActressQuery(value);

    if (actressDebounceRef.current) {
      clearTimeout(actressDebounceRef.current);
    }

    actressDebounceRef.current = setTimeout(() => {
      executeActressSearch(value);
    }, 500);
  };

  // 作品検索入力時のハンドラ（デバウンス500ms）
  const handleProductChange = (value: string) => {
    setProductQuery(value);

    if (productDebounceRef.current) {
      clearTimeout(productDebounceRef.current);
    }

    productDebounceRef.current = setTimeout(() => {
      executeProductSearch(value);
    }, 700);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (actressDebounceRef.current) clearTimeout(actressDebounceRef.current);
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* 女優名検索 */}
      <div className="relative flex-1">
        <input
          type="text"
          value={actressQuery}
          onChange={(e) => handleActressChange(e.target.value)}
          placeholder="女優名・AIレビューで検索..."
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
      </div>

      {/* 作品検索（作品名・作品ID・メーカー品番） */}
      <div className="relative flex-1">
        <input
          type="text"
          value={productQuery}
          onChange={(e) => handleProductChange(e.target.value)}
          placeholder="作品名・作品ID・AI説明文で検索..."
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
      </div>
    </div>
  );
}
