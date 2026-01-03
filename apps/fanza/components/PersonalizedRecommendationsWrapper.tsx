'use client';

import { PersonalizedRecommendations } from '@adult-v/shared/components';

interface PersonalizedRecommendationsWrapperProps {
  locale: string;
}

export default function PersonalizedRecommendationsWrapper({
  locale,
}: PersonalizedRecommendationsWrapperProps) {
  return (
    <PersonalizedRecommendations
      locale={locale}
      theme="light"
      limit={8}
      showAnalysis={false}
    />
  );
}
