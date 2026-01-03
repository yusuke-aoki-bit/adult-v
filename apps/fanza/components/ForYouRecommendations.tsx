'use client';

import { PersonalizedRecommendations } from '@adult-v/shared/components';

interface ForYouRecommendationsProps {
  locale?: string;
}

/**
 * あなたへのおすすめセクション
 * LLM分析による視聴履歴ベースのパーソナライズレコメンド
 */
export default function ForYouRecommendations({ locale = 'ja' }: ForYouRecommendationsProps) {
  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <PersonalizedRecommendations
          locale={locale}
          theme="light"
          limit={8}
          showAnalysis={false}
        />
      </div>
    </section>
  );
}
