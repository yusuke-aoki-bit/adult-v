'use client';

import { ConnectedForYouRecommendations } from '@adult-v/shared/components';

interface ForYouRecommendationsProps {
  locale?: string;
}

/**
 * あなたへのおすすめセクション
 * LLM分析による視聴履歴ベースのパーソナライズレコメンド
 */
export default function ForYouRecommendations({ locale = 'ja' }: ForYouRecommendationsProps) {
  return <ConnectedForYouRecommendations locale={locale} />;
}
