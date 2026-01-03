'use client';

import { AiSearchBar } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface AiSearchBarWrapperProps {
  locale: string;
}

export default function AiSearchBarWrapper({ locale }: AiSearchBarWrapperProps) {
  const router = useRouter();

  const handleSearch = useCallback((result: {
    searchParams: Record<string, string | string[]>;
    redirect?: string;
    message?: string;
    relatedTerms?: string[];
  }) => {
    // リダイレクト先がある場合（女優ページなど）
    if (result.redirect) {
      router.push(result.redirect);
      return;
    }

    // 検索パラメータからURLを構築
    const params = new URLSearchParams();

    Object.entries(result.searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else if (value) {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(`/${locale}/products${queryString ? `?${queryString}` : ''}`);
  }, [router, locale]);

  return (
    <AiSearchBar
      locale={locale}
      theme="light"
      onSearch={handleSearch}
      apiEndpoint="/api/search/ai"
    />
  );
}
