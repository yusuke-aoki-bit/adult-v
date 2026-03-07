'use client';

import { UserPreferenceProfile } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { localizedHref } from '../i18n';

interface UserPreferenceProfileWrapperProps {
  locale: string;
}

export default function UserPreferenceProfileWrapper({ locale }: UserPreferenceProfileWrapperProps) {
  const router = useRouter();

  const handleTagClick = useCallback(
    (tag: string) => {
      router.push(localizedHref(`/products?q=${encodeURIComponent(tag)}`, locale));
    },
    [router, locale],
  );

  return <UserPreferenceProfile locale={locale} onTagClick={handleTagClick} />;
}
