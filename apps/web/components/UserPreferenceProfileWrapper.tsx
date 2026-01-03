'use client';

import { UserPreferenceProfile } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface UserPreferenceProfileWrapperProps {
  locale: string;
}

export default function UserPreferenceProfileWrapper({ locale }: UserPreferenceProfileWrapperProps) {
  const router = useRouter();

  const handleTagClick = useCallback((tag: string) => {
    // タグで検索ページへ遷移
    router.push(`/${locale}/products?q=${encodeURIComponent(tag)}`);
  }, [router, locale]);

  return (
    <UserPreferenceProfile
      locale={locale}
      theme="dark"
      onTagClick={handleTagClick}
    />
  );
}
