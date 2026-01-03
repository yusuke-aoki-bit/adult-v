'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SearchBarBase, type AiSearchResult } from '@adult-v/shared/components';

/**
 * SearchBar for adult-v (dark theme)
 * AI検索機能をヘッダーに統合
 */
export default function SearchBar() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'ja';

  const handleActressSearch = useCallback((query: string) => {
    router.push(`/${locale}/?q=${encodeURIComponent(query)}`);
  }, [router, locale]);

  const handleProductSearch = useCallback(async (query: string) => {
    try {
      // First search by product ID
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(query)}`);

      if (response.ok) {
        const data = await response.json();
        if (data.product) {
          router.push(`/${locale}/products/${data.product.id}`);
          return;
        }
      }

      // If not found by ID, search by title
      router.push(`/${locale}/search?q=${encodeURIComponent(query)}&type=products`);
    } catch (error) {
      console.error('Search error:', error);
      router.push(`/${locale}/search?q=${encodeURIComponent(query)}&type=products`);
    }
  }, [router, locale]);

  const handleAiSearch = useCallback((result: AiSearchResult) => {
    // リダイレクト先がある場合（女優ページなど）
    if (result.redirect) {
      router.push(result.redirect);
      return;
    }

    // 検索パラメータからURLを構築
    const searchParams = new URLSearchParams();

    Object.entries(result.searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else if (value) {
        searchParams.set(key, value);
      }
    });

    const queryString = searchParams.toString();
    router.push(`/${locale}/products${queryString ? `?${queryString}` : ''}`);
  }, [router, locale]);

  return (
    <SearchBarBase
      theme="dark"
      locale={locale}
      onActressSearch={handleActressSearch}
      onProductSearch={handleProductSearch}
      onAiSearch={handleAiSearch}
      aiApiEndpoint="/api/search/ai"
    />
  );
}
