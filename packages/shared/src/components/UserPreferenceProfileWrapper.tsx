'use client';

import { UserPreferenceProfile } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UserPreferenceProfileWrapperProps {
  locale: string;
}

export default function UserPreferenceProfileWrapper({ locale }: UserPreferenceProfileWrapperProps) {
  const router = useRouter();

  const handleTagClick = useCallback(
    (tag: string) => {
      router.push(`/${locale}/products?q=${encodeURIComponent(tag)}`);
    },
    [router, locale],
  );

  return <UserPreferenceProfile locale={locale} onTagClick={handleTagClick} />;
}
