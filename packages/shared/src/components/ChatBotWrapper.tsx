'use client';

import { ChatBot } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface ChatBotWrapperProps {
  locale: string;
}

export default function ChatBotWrapper({ locale }: ChatBotWrapperProps) {
  const router = useRouter();

  const handleSearch = useCallback(
    (params: { query?: string; genres?: string[]; performers?: string[] }) => {
      const searchParams = new URLSearchParams();

      if (params.query) {
        searchParams.set('q', params.query);
      }
      if (params.genres && params.genres.length > 0) {
        searchParams.set('include', params.genres.join(','));
      }
      if (params.performers && params.performers.length > 0) {
        searchParams.set('performer', params.performers[0]!);
      }

      const queryString = searchParams.toString();
      router.push(`/${locale}/products${queryString ? `?${queryString}` : ''}`);
    },
    [router, locale],
  );

  return <ChatBot locale={locale} onSearch={handleSearch} apiEndpoint="/api/chat" />;
}
