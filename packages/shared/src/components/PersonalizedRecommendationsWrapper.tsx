'use client';

import { PersonalizedRecommendations } from './';

interface PersonalizedRecommendationsWrapperProps {
  locale: string;
}

export default function PersonalizedRecommendationsWrapper({ locale }: PersonalizedRecommendationsWrapperProps) {
  return <PersonalizedRecommendations locale={locale} limit={8} showAnalysis={false} />;
}
