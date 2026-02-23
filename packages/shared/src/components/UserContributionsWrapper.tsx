'use client';

import { UserContributionsSection } from './';
import { useFirebaseAuth } from '../contexts';
import type { UserContributionsSectionTranslations } from './';
import { userContributionsTranslations } from '../lib/translations';

const translations = userContributionsTranslations as Record<string, UserContributionsSectionTranslations>;

interface UserContributionsWrapperProps {
  productId: number;
  locale: string;
  existingTags?: string[];
  existingPerformers?: string[];
}

export default function UserContributionsWrapper({
  productId,
  locale,
  existingTags = [],
  existingPerformers = [],
}: UserContributionsWrapperProps) {
  const { user, linkGoogle } = useFirebaseAuth();
  const t = translations[locale] ?? translations['ja']!;

  const handleLoginRequired = () => {
    // Googleログインをトリガー
    linkGoogle();
  };

  return (
    <UserContributionsSection
      productId={productId}
      userId={user?.uid || null}
      existingTags={existingTags}
      existingPerformers={existingPerformers}
      onLoginRequired={handleLoginRequired}
      translations={t}
      defaultExpanded={false}
    />
  );
}
