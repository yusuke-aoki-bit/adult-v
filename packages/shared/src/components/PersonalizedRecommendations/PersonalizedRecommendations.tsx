'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target } from 'lucide-react';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { ProductCardBase } from '../ProductCard';

interface RecommendedProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  matchType: 'performer' | 'genre' | 'ai_suggested';
  matchReason?: string;
}

interface UserProfile {
  topPerformers: Array<{ id: number; name: string; count: number }>;
  topGenres: Array<{ id: number; name: string; count: number }>;
}

interface Analysis {
  userPreferences: {
    favoriteGenres: string[];
    favoriteActresses: string[];
    preferredDuration: string;
    viewingPattern: string;
  };
  recommendations: {
    genres: string[];
    searchKeywords: string[];
    reason: string;
  };
  personalizedMessage: string;
}

interface PersonalizedRecommendationsProps {
  locale?: string;
  theme?: 'light' | 'dark';
  apiEndpoint?: string;
  limit?: number;
  showAnalysis?: boolean;
  className?: string;
  /** デフォルトで開いた状態にするか */
  defaultOpen?: boolean;
}

export function PersonalizedRecommendations({
  locale = 'ja',
  theme = 'dark',
  apiEndpoint = '/api/recommendations/from-history',
  limit = 8,
  showAnalysis = false,
  className = '',
  defaultOpen = false,
}: PersonalizedRecommendationsProps) {
  const { items: recentlyViewed, isLoading: historyLoading } = useRecentlyViewed();
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExpanded, setHasExpanded] = useState(defaultOpen);

  const isDark = theme === 'dark';

  const fetchRecommendations = useCallback(async () => {
    if (recentlyViewed.length < 3) {
      setMessage(locale === 'ja'
        ? 'もう少し作品を閲覧するとおすすめが表示されます'
        : 'View more products to get personalized recommendations');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: recentlyViewed.map(item => ({
            id: item.id,
            title: item.title,
          })),
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();

      if (data.success) {
        setRecommendations(data.recommendations || []);
        setAnalysis(data.analysis || null);
        setUserProfile(data.userProfile || null);
        setMessage(data.message || '');
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('[PersonalizedRecommendations] Error:', err);
      setError(locale === 'ja' ? 'おすすめの取得に失敗しました' : 'Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [recentlyViewed, apiEndpoint, limit, locale]);

  // 展開時にフェッチをトリガー
  const handleToggle = useCallback((isOpen: boolean) => {
    if (isOpen && !hasExpanded) {
      setHasExpanded(true);
    }
  }, [hasExpanded]);

  useEffect(() => {
    if (!historyLoading && recentlyViewed.length > 0 && hasExpanded) {
      fetchRecommendations();
    }
  }, [historyLoading, recentlyViewed.length, fetchRecommendations, hasExpanded]);

  // 履歴がない場合は非表示
  if (!historyLoading && recentlyViewed.length < 3) {
    return null;
  }

  // コンテンツのレンダリング
  const renderContent = () => {
    // 未展開またはローディング中
    if (!hasExpanded || isLoading || historyLoading) {
      return <ProductSkeleton count={8} size="mini" />;
    }

    // エラー
    if (error) {
      return (
        <div className={`flex flex-col items-center justify-center py-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="text-sm mb-3">{error}</p>
          <button
            onClick={fetchRecommendations}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'bg-pink-600 hover:bg-pink-500 text-white'
                : 'bg-pink-500 hover:bg-pink-600 text-white'
            }`}
          >
            {locale === 'ja' ? '再試行' : 'Retry'}
          </button>
        </div>
      );
    }

    // 結果がない
    if (recommendations.length === 0) {
      return (
        <p className={`text-sm py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {message || (locale === 'ja' ? 'おすすめを取得できませんでした' : 'No recommendations found')}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {/* 分析結果（オプション） */}
        {showAnalysis && analysis && (
          <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
            <p className={`font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {locale === 'ja' ? 'あなたの傾向' : 'Your Preferences'}
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.userPreferences.favoriteGenres.slice(0, 5).map((genre, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded text-xs ${
                    isDark ? 'bg-pink-900/50 text-pink-300' : 'bg-pink-100 text-pink-700'
                  }`}
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ユーザープロファイル（好みの女優・ジャンル） */}
        {userProfile && (userProfile.topPerformers.length > 0 || userProfile.topGenres.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {userProfile.topPerformers.slice(0, 3).map((p) => (
              <span
                key={`p-${p.id}`}
                className={`px-2 py-1 rounded-full text-xs ${
                  isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {p.name}
              </span>
            ))}
            {userProfile.topGenres.slice(0, 3).map((g) => (
              <span
                key={`g-${g.id}`}
                className={`px-2 py-1 rounded-full text-xs ${
                  isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                }`}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* おすすめ作品グリッド - ProductCardBase使用 */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {recommendations.map((product) => (
            <ProductCardBase
              key={product.id}
              product={{
                id: String(product.id),
                title: product.title,
                imageUrl: product.imageUrl ?? undefined,
                releaseDate: product.releaseDate ?? undefined,
                price: 0,
              }}
              size="mini"
              theme={theme}
            />
          ))}
        </div>
      </div>
    );
  };

  const bgClass = isDark
    ? 'bg-linear-to-r from-purple-900/30 to-pink-900/30'
    : 'bg-linear-to-r from-purple-50 to-pink-50';

  const iconColorClass = isDark ? 'text-purple-400' : 'text-purple-500';

  return (
    <AccordionSection
      icon={<Target className="w-5 h-5" />}
      title={locale === 'ja' ? 'あなたへのおすすめ' : 'Recommended for You'}
      itemCount={hasExpanded && recommendations.length > 0 ? recommendations.length : undefined}
      defaultOpen={defaultOpen}
      onToggle={handleToggle}
      iconColorClass={iconColorClass}
      bgClass={bgClass}
      className={className}
    >
      {renderContent()}
    </AccordionSection>
  );
}
