'use client';

import { memo } from 'react';
import { useParams } from 'next/navigation';
import { ActressAiReview as ActressAiReviewType } from '../types/product';

export type ActressAiReviewTheme = 'dark' | 'light';

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    profile: 'のプロフィール',
    actingStyle: '演技スタイル',
    appealPoints: '魅力ポイント',
    recommendedFor: 'こんな方におすすめ',
    lastUpdated: '最終更新:',
  },
  en: {
    profile: "'s Profile",
    actingStyle: 'Acting Style',
    appealPoints: 'Appeal Points',
    recommendedFor: 'Recommended For',
    lastUpdated: 'Last Updated:',
  },
  zh: {
    profile: '的简介',
    actingStyle: '表演风格',
    appealPoints: '魅力点',
    recommendedFor: '推荐给这样的您',
    lastUpdated: '最后更新:',
  },
  ko: {
    profile: '의 프로필',
    actingStyle: '연기 스타일',
    appealPoints: '매력 포인트',
    recommendedFor: '이런 분께 추천',
    lastUpdated: '최종 업데이트:',
  },
} as const;

// Theme configuration
const themeConfig = {
  dark: {
    container: 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl',
    title: 'text-xl font-bold text-white flex items-center gap-2',
    titleIcon: 'w-5 h-5 text-purple-400',
    overview: 'text-gray-300 leading-relaxed',
    styleCard: 'bg-gray-700/50 rounded-xl p-4',
    styleTitle: 'text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2',
    appealCard: 'bg-gray-700/50 rounded-xl p-4',
    appealTitle: 'text-sm font-semibold text-pink-300 mb-2 flex items-center gap-2',
    cardText: 'text-gray-300 text-sm',
    recommendCard: 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4',
    recommendTitle: 'text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2',
    keywordBadge: 'text-xs px-3 py-1 rounded-full bg-gray-700 text-gray-300 border border-gray-600',
    updatedAt: 'text-xs text-gray-500 pt-2 border-t border-gray-700 flex items-center gap-1',
  },
  light: {
    container: 'bg-white rounded-2xl p-6 shadow-sm border border-gray-200',
    title: 'text-xl font-bold text-gray-800 flex items-center gap-2',
    titleIcon: 'w-5 h-5 text-purple-600',
    overview: 'text-gray-600 leading-relaxed',
    styleCard: 'bg-purple-50 rounded-xl p-4 border border-purple-100',
    styleTitle: 'text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2',
    appealCard: 'bg-rose-50 rounded-xl p-4 border border-rose-100',
    appealTitle: 'text-sm font-semibold text-rose-700 mb-2 flex items-center gap-2',
    cardText: 'text-gray-600 text-sm',
    recommendCard: 'bg-blue-50 border border-blue-200 rounded-xl p-4',
    recommendTitle: 'text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2',
    keywordBadge: 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200',
    updatedAt: 'text-xs text-gray-500 pt-2 border-t border-gray-200 flex items-center gap-1',
  },
} as const;

interface ActressAiReviewProps {
  review: ActressAiReviewType;
  updatedAt?: string;
  actressName: string;
  theme?: ActressAiReviewTheme;
}

const ActressAiReview = memo(function ActressAiReview({ review, updatedAt, actressName, theme = 'dark' }: ActressAiReviewProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const colors = themeConfig[theme];

  return (
    <div className={colors.container}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={colors.title}>
          <svg className={colors.titleIcon} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {actressName}{t.profile}
        </h2>
      </div>

      <div className="space-y-4">
        {/* 概要 */}
        <div>
          <p className={colors.overview}>
            {review.overview}
          </p>
        </div>

        {/* スタイル・魅力 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={colors.styleCard}>
            <h3 className={colors.styleTitle}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {t.actingStyle}
            </h3>
            <p className={colors.cardText}>
              {review.style}
            </p>
          </div>

          <div className={colors.appealCard}>
            <h3 className={colors.appealTitle}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              {t.appealPoints}
            </h3>
            <p className={colors.cardText}>
              {review.appeal}
            </p>
          </div>
        </div>

        {/* おすすめ */}
        <div className={colors.recommendCard}>
          <h3 className={colors.recommendTitle}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {t.recommendedFor}
          </h3>
          <p className={colors.cardText}>
            {review.recommendation}
          </p>
        </div>

        {/* キーワード */}
        {review.keywords && review.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {review.keywords.map((keyword) => (
              <span
                key={keyword}
                className={colors.keywordBadge}
              >
                #{keyword}
              </span>
            ))}
          </div>
        )}

        {/* 更新日時 */}
        {updatedAt && (
          <div className={colors.updatedAt}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t.lastUpdated} {new Date(updatedAt).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
          </div>
        )}
      </div>
    </div>
  );
});

export default ActressAiReview;
