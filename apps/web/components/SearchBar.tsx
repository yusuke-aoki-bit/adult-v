'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UnifiedSearchBar } from '@adult-v/shared/components';

/**
 * SearchBar for adult-v (dark theme)
 * 統合検索バー：作品・女優・画像検索を1つに集約
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

  return (
    <UnifiedSearchBar
      theme="dark"
      locale={locale}
      onActressSearch={handleActressSearch}
      onProductSearch={handleProductSearch}
    />
  );
}
