'use client';

import { useSiteTheme } from '../contexts/SiteThemeContext';
import { PersonalizedRecommendations } from './PersonalizedRecommendations';

interface ConnectedForYouRecommendationsProps {
  locale?: string;
  limit?: number;
  showAnalysis?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * あなたへのおすすめセクション
 * SiteThemeContextから自動的にテーマを取得
 */
export default function ConnectedForYouRecommendations({
  locale = 'ja',
  limit = 8,
  showAnalysis = false,
  defaultOpen,
  className,
}: ConnectedForYouRecommendationsProps) {
  const { theme } = useSiteTheme();

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <PersonalizedRecommendations
          locale={locale}
          theme={theme}
          limit={limit}
          showAnalysis={showAnalysis}
          {...(defaultOpen !== undefined && { defaultOpen })}
          {...(className && { className })}
        />
      </div>
    </section>
  );
}
