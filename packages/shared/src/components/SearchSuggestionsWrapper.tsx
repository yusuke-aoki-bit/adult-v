'use client';

import { SearchSuggestions } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface SearchSuggestionsWrapperProps {
  query: string;
  locale: string;
}

export default function SearchSuggestionsWrapper({ query, locale }: SearchSuggestionsWrapperProps) {
  const router = useRouter();

  const handleTermClick = useCallback(
    (term: string) => {
      router.push(`/${locale}/products?q=${encodeURIComponent(term)}`);
    },
    [router, locale],
  );

  const handleGenreClick = useCallback(
    (genre: string) => {
      router.push(`/${locale}/products?include=${encodeURIComponent(genre)}`);
    },
    [router, locale],
  );

  const handlePerformerClick = useCallback(
    (performer: string) => {
      router.push(`/${locale}/?q=${encodeURIComponent(performer)}`);
    },
    [router, locale],
  );

  if (!query) return null;

  return (
    <div className="mb-4">
      <SearchSuggestions
        query={query}
        locale={locale}
        onTermClick={handleTermClick}
        onGenreClick={handleGenreClick}
        onPerformerClick={handlePerformerClick}
      />
    </div>
  );
}
