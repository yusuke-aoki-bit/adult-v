'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SearchBarBase } from '@adult-v/shared/components';
import { localizedHref } from '@adult-v/shared/i18n';

/**
 * SearchBar for FANZA (light theme)
 */
export default function SearchBar() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'ja';

  const handleActressSearch = useCallback((query: string) => {
    router.push(localizedHref(`/?q=${encodeURIComponent(query)}`, locale));
  }, [router, locale]);

  const handleProductSearch = useCallback(async (query: string) => {
    try {
      // First search by product ID
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(query)}`);

      if (response.ok) {
        const data = await response.json();
        if (data.product) {
          router.push(localizedHref(`/products/${data.product.id}`, locale));
          return;
        }
      }

      // If not found by ID, search by title
      router.push(localizedHref(`/search?q=${encodeURIComponent(query)}&type=products`, locale));
    } catch (error) {
      console.error('Search error:', error);
      router.push(localizedHref(`/search?q=${encodeURIComponent(query)}&type=products`, locale));
    }
  }, [router, locale]);

  return (
    <SearchBarBase
      theme="light"
      locale={locale}
      onActressSearch={handleActressSearch}
      onProductSearch={handleProductSearch}
    />
  );
}
