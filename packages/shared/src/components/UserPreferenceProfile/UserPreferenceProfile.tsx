'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';

interface UserProfile {
  profileType: 'casual' | 'explorer' | 'collector' | 'specialist';
  profileTitle: string;
  profileDescription: string;
  primaryTags: string[];
  secondaryTags: string[];
  avoidTags: string[];
  preferences: {
    actressPreference: 'specific' | 'variety' | 'mixed';
    genreDepth: 'shallow' | 'medium' | 'deep';
    newVsClassic: 'new' | 'classic' | 'balanced';
    contentStyle: string;
  };
  suggestedActions: string[];
  confidenceScore: number;
}

interface Stats {
  totalViewed: number;
  uniquePerformers: number;
  uniqueGenres: number;
  topPerformers: string[];
  topGenres: string[];
}

interface UserPreferenceProfileProps {
  locale?: string;
  theme?: 'light' | 'dark';
  apiEndpoint?: string;
  onTagClick?: (tag: string) => void;
  className?: string;
}

const profileTypeLabels = {
  casual: { ja: '気軽派', en: 'Casual', icon: '🎯' },
  explorer: { ja: '探求者', en: 'Explorer', icon: '🔍' },
  collector: { ja: '収集家', en: 'Collector', icon: '📚' },
  specialist: { ja: '専門家', en: 'Specialist', icon: '🎓' },
};

const preferenceLabels = {
  actressPreference: {
    specific: { ja: '推し女優派', en: 'Specific' },
    variety: { ja: '多様派', en: 'Variety' },
    mixed: { ja: 'バランス派', en: 'Mixed' },
  },
  genreDepth: {
    shallow: { ja: '浅く広く', en: 'Shallow' },
    medium: { ja: 'バランス', en: 'Medium' },
    deep: { ja: '深く狭く', en: 'Deep' },
  },
  newVsClassic: {
    new: { ja: '新作重視', en: 'New' },
    classic: { ja: '旧作好き', en: 'Classic' },
    balanced: { ja: 'バランス', en: 'Balanced' },
  },
};

export function UserPreferenceProfile({
  locale = 'ja',
  theme = 'dark',
  apiEndpoint = '/api/user/profile',
  onTagClick,
  className = '',
}: UserPreferenceProfileProps) {
  const { items: recentlyViewed, isLoading: historyLoading } = useRecentlyViewed();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isDark = theme === 'dark';

  const fetchProfile = useCallback(async () => {
    if (recentlyViewed.length < 5) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: recentlyViewed.map(item => ({
            id: item['id'],
            title: item['title'],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();

      if (data.success && data.profile) {
        setProfile(data.profile);
        setStats(data.stats || null);
      } else {
        setError(data.message || 'プロファイル生成に失敗しました');
      }
    } catch (err) {
      console.error('[UserPreferenceProfile] Error:', err);
      setError(locale === 'ja' ? 'プロファイルの取得に失敗しました' : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [recentlyViewed, apiEndpoint, locale]);

  useEffect(() => {
    if (!historyLoading && recentlyViewed.length >= 5 && !profile) {
      fetchProfile();
    }
  }, [historyLoading, recentlyViewed.length, fetchProfile, profile]);

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  // 履歴が少ない場合
  if (!historyLoading && recentlyViewed.length < 5) {
    return (
      <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📊</span>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {locale === 'ja' ? 'あなたの好みプロファイル' : 'Your Preference Profile'}
          </h3>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {locale === 'ja'
            ? `あと${5 - recentlyViewed.length}件閲覧するとプロファイルが生成されます`
            : `View ${5 - recentlyViewed.length} more to generate your profile`}
        </p>
        <div className="mt-3 flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < recentlyViewed.length
                  ? isDark ? 'bg-pink-500' : 'bg-pink-400'
                  : isDark ? 'bg-gray-700' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // ローディング中
  if (isLoading || historyLoading) {
    return (
      <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl animate-pulse">📊</span>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {locale === 'ja' ? 'プロファイルを分析中...' : 'Analyzing your profile...'}
          </h3>
        </div>
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} style={{ width: '60%' }} />
          <div className={`h-3 rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} style={{ width: '80%' }} />
        </div>
      </div>
    );
  }

  // エラー
  if (error || !profile) {
    return null;
  }

  const typeInfo = profileTypeLabels[profile.profileType];

  return (
    <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
      {/* ヘッダー */}
      <div
        className={`p-4 sm:p-6 cursor-pointer transition-colors ${
          isDark ? 'hover:bg-gray-800/70' : 'hover:bg-gray-200/70'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{typeInfo.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profile.profileTitle}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                }`}>
                  {locale === 'ja' ? typeInfo.ja : typeInfo.en}
                </span>
              </div>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {profile.profileDescription}
              </p>
            </div>
          </div>

          {/* 展開ボタン */}
          <button className={`p-1 rounded-full ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300'}`}>
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 主要タグ（常に表示） */}
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.primaryTags.map((tag, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                handleTagClick(tag);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isDark
                  ? 'bg-pink-900/50 text-pink-300 hover:bg-pink-800/50'
                  : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 展開コンテンツ */}
      {isExpanded && (
        <div className={`px-4 sm:px-6 pb-4 sm:pb-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* 副次タグ */}
          {profile.secondaryTags.length > 0 && (
            <div className="mt-4">
              <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {locale === 'ja' ? '副次的な好み' : 'Secondary Preferences'}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.secondaryTags.map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => handleTagClick(tag)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 傾向分析 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {locale === 'ja' ? '女優傾向' : 'Actress'}
              </p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.actressPreference[profile.preferences.actressPreference][locale === 'ja' ? 'ja' : 'en']}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {locale === 'ja' ? 'ジャンル' : 'Genre'}
              </p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.genreDepth[profile.preferences.genreDepth][locale === 'ja' ? 'ja' : 'en']}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {locale === 'ja' ? '作品年代' : 'Era'}
              </p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.newVsClassic[profile.preferences.newVsClassic][locale === 'ja' ? 'ja' : 'en']}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {locale === 'ja' ? '信頼度' : 'Confidence'}
              </p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {profile.confidenceScore}%
              </p>
            </div>
          </div>

          {/* おすすめアクション */}
          {profile.suggestedActions.length > 0 && (
            <div className="mt-4">
              <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                💡 {locale === 'ja' ? 'おすすめアクション' : 'Suggested Actions'}
              </p>
              <ul className="space-y-1">
                {profile.suggestedActions.map((action, i) => (
                  <li
                    key={i}
                    className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    • {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 統計情報 */}
          {stats && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-4 text-xs">
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  📊 {stats.totalViewed}件閲覧
                </span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  👤 {stats.uniquePerformers}名の女優
                </span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  🏷️ {stats.uniqueGenres}ジャンル
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
