'use client';

import { SearchSuggestions } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { localizedHref } from '../i18n';

interface SearchSuggestionsWrapperProps {
  query: string;
  locale: string;
}

export default function SearchSuggestionsWrapper({ query, locale }: SearchSuggestionsWrapperProps) {
  const router = useRouter();

  const handleTermClick = useCallback(
    (term: string) => {
      router.push(localizedHref(`/products?q=${encodeURIComponent(term)}`, locale));
    },
    [router, locale],
  );

  const handleGenreClick = useCallback(
    (genre: string) => {
      router.push(localizedHref(`/products?include=${encodeURIComponent(genre)}`, locale));
    },
    [router, locale],
  );

  const handlePerformerClick = useCallback(
    (performer: string) => {
      router.push(localizedHref(`/?q=${encodeURIComponent(performer)}`, locale));
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
