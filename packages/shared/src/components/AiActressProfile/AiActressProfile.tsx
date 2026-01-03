'use client';

import { useState, useEffect, useCallback } from 'react';

// Translations
const translations = {
  ja: {
    title: 'AIプロフィール',
    loading: 'プロフィールを読み込み中...',
    characteristics: '特徴',
    popularGenres: '得意ジャンル',
    careerSummary: 'キャリア',
    recommendedFor: 'こんな方におすすめ',
  },
  en: {
    title: 'AI Profile',
    loading: 'Loading profile...',
    characteristics: 'Characteristics',
    popularGenres: 'Popular Genres',
    careerSummary: 'Career',
    recommendedFor: 'Recommended for',
  },
  zh: {
    title: 'AI简介',
    loading: '加载简介中...',
    characteristics: '特点',
    popularGenres: '擅长类型',
    careerSummary: '职业生涯',
    recommendedFor: '推荐给',
  },
  ko: {
    title: 'AI 프로필',
    loading: '프로필 로딩 중...',
    characteristics: '특징',
    popularGenres: '인기 장르',
    careerSummary: '커리어',
    recommendedFor: '추천 대상',
  },
} as const;

interface AiProfile {
  introduction: string;
  characteristics: string[];
  popularGenres: string[];
  careerSummary: string;
  recommendedFor: string;
}

interface AiActressProfileProps {
  actressId: string;
  locale?: string;
  theme?: 'dark' | 'light';
  apiEndpoint?: string;
  /** @deprecated AIプロフィールはシステム事前生成のため、自動的に読み込まれます */
  autoLoad?: boolean;
}

/**
 * AIプロフィール表示コンポーネント
 *
 * プロフィールはシステム側で事前生成されます。
 * このコンポーネントは事前生成されたプロフィールを取得して表示するのみです。
 * プロフィールがまだ生成されていない場合は何も表示しません。
 */
export function AiActressProfile({
  actressId,
  locale = 'ja',
  theme = 'dark',
  apiEndpoint,
}: AiActressProfileProps) {
  const [profile, setProfile] = useState<AiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  // APIエンドポイント - 事前生成されたプロフィールを取得
  const endpoint = apiEndpoint || `/api/actresses/${actressId}/ai-profile`;

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
      // 404の場合はプロフィールがまだ生成されていない - 何も表示しない
    } catch {
      // エラー時も何も表示しない
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  // 自動的に読み込み
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const baseClass = theme === 'dark'
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-gray-50 border-gray-200';

  const textClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-700';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const chipClass = theme === 'dark'
    ? 'bg-gray-700 text-gray-300'
    : 'bg-gray-200 text-gray-600';
  const genreChipClass = theme === 'dark'
    ? 'bg-rose-900/50 text-rose-200'
    : 'bg-rose-100 text-rose-700';

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-4 rounded-lg border ${baseClass} flex items-center justify-center gap-2`}>
        <div className={`animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full ${mutedClass}`} />
        <span className={mutedClass}>{t.loading}</span>
      </div>
    );
  }

  // プロフィールがない場合は何も表示しない
  if (!profile) return null;

  return (
    <div className={`rounded-lg border ${baseClass} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className={`font-medium ${textClass}`}>{t.title}</h3>
      </div>

      {/* Introduction */}
      <p className={textClass}>{profile.introduction}</p>

      {/* Characteristics */}
      {profile.characteristics && profile.characteristics.length > 0 && (
        <div>
          <h4 className={`text-sm font-medium mb-2 ${mutedClass}`}>{t.characteristics}</h4>
          <div className="flex flex-wrap gap-2">
            {profile.characteristics.map((char, i) => (
              <span key={i} className={`px-3 py-1 text-sm rounded-full ${chipClass}`}>
                {char}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Popular genres */}
      {profile.popularGenres && profile.popularGenres.length > 0 && (
        <div>
          <h4 className={`text-sm font-medium mb-2 ${mutedClass}`}>{t.popularGenres}</h4>
          <div className="flex flex-wrap gap-2">
            {profile.popularGenres.map((genre, i) => (
              <span key={i} className={`px-3 py-1 text-sm rounded-full ${genreChipClass}`}>
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Career summary */}
      {profile.careerSummary && (
        <div>
          <h4 className={`text-sm font-medium mb-1 ${mutedClass}`}>{t.careerSummary}</h4>
          <p className={`text-sm ${textClass}`}>{profile.careerSummary}</p>
        </div>
      )}

      {/* Recommended for */}
      {profile.recommendedFor && (
        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
          <h4 className={`text-xs font-medium mb-1 ${mutedClass}`}>{t.recommendedFor}</h4>
          <p className={`text-sm ${textClass}`}>{profile.recommendedFor}</p>
        </div>
      )}
    </div>
  );
}
