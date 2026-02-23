'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import {
  getTranslation,
  userPreferenceProfileTranslations,
  profileTypeLabels,
  preferenceLabels,
} from '../../lib/translations';

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

function getProfileText(locale: string) {
  return getTranslation(userPreferenceProfileTranslations, locale);
}

function getLocaleKey(locale: string): 'ja' | 'en' {
  return locale === 'ja' ? 'ja' : 'en';
}

export function UserPreferenceProfile({
  locale = 'ja',
  theme: themeProp,
  apiEndpoint = '/api/user/profile',
  onTagClick,
  className = '',
}: UserPreferenceProfileProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const pt = getProfileText(locale);
  const localeKey = getLocaleKey(locale);
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
          history: recentlyViewed.map((item) => ({
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
      setError(pt.fetchError);
    } finally {
      setIsLoading(false);
    }
  }, [recentlyViewed, apiEndpoint, pt]);

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
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{pt.title}</h3>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {pt.viewMore(5 - recentlyViewed.length)}
        </p>
        <div className="mt-3 flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < recentlyViewed.length
                  ? isDark
                    ? 'bg-pink-500'
                    : 'bg-pink-400'
                  : isDark
                    ? 'bg-gray-700'
                    : 'bg-gray-300'
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
        <div className="mb-3 flex items-center gap-2">
          <span className="animate-pulse text-xl">📊</span>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{pt.analyzing}</h3>
        </div>
        <div className="space-y-2">
          <div
            className={`h-4 animate-pulse rounded ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
            style={{ width: '60%' }}
          />
          <div
            className={`h-3 animate-pulse rounded ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
            style={{ width: '80%' }}
          />
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
    <div className={`overflow-hidden rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
      {/* ヘッダー */}
      <div
        className={`cursor-pointer p-4 transition-colors sm:p-6 ${
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
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {typeInfo[localeKey]}
                </span>
              </div>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {profile.profileDescription}
              </p>
            </div>
          </div>

          {/* 展開ボタン */}
          <button className={`rounded-full p-1 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300'}`}>
            <svg
              className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
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
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
        <div className={`border-t px-4 pb-4 sm:px-6 sm:pb-6 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* 副次タグ */}
          {profile.secondaryTags.length > 0 && (
            <div className="mt-4">
              <p className={`mb-2 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {pt.secondaryPreferences}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.secondaryTags.map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => handleTagClick(tag)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
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
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{pt.actressTrend}</p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.actressPreference[profile.preferences.actressPreference][localeKey]}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{pt.genre}</p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.genreDepth[profile.preferences.genreDepth][localeKey]}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{pt.era}</p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {preferenceLabels.newVsClassic[profile.preferences.newVsClassic][localeKey]}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-white'}`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{pt.confidence}</p>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {profile.confidenceScore}%
              </p>
            </div>
          </div>

          {/* おすすめアクション */}
          {profile.suggestedActions.length > 0 && (
            <div className="mt-4">
              <p className={`mb-2 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                💡 {pt.suggestedActions}
              </p>
              <ul className="space-y-1">
                {profile.suggestedActions.map((action, i) => (
                  <li key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 統計情報 */}
          {stats && (
            <div className={`mt-4 border-t pt-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-4 text-xs">
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  📊 {pt.statsViewed(stats.totalViewed)}
                </span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  👤 {pt.statsPerformers(stats.uniquePerformers)}
                </span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  🏷️ {pt.statsGenres(stats.uniqueGenres)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
