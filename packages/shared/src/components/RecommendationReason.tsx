'use client';

import { useState, useEffect } from 'react';

interface RecommendationReasonProps {
  productId: string | number;
  locale: string;
  theme?: 'dark' | 'light';
  compact?: boolean;
}

interface ReasonData {
  reasons: string[];
  matchScore: number;
  matchedTags: string[];
  matchedPerformers: string[];
}

export function RecommendationReason({
  productId,
  locale,
  theme = 'dark',
  compact = false,
}: RecommendationReasonProps) {
  const [data, setData] = useState<ReasonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isDark = theme === 'dark';

  const t = {
    whyRecommended: locale === 'ja' ? 'おすすめの理由' : 'Why this is recommended',
    loading: locale === 'ja' ? '読み込み中...' : 'Loading...',
    matchScore: locale === 'ja' ? 'マッチ度' : 'Match score',
    basedOn: locale === 'ja' ? '以下の理由でおすすめ' : 'Based on',
    tags: locale === 'ja' ? 'ジャンル' : 'Genres',
    performers: locale === 'ja' ? '出演者' : 'Performers',
    showMore: locale === 'ja' ? '詳細を見る' : 'Show more',
    showLess: locale === 'ja' ? '閉じる' : 'Show less',
  };

  const fetchReason = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/recommendations/explain?productId=${productId}&locale=${locale}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch recommendation reason:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && !data) {
      fetchReason();
    }
  }, [isExpanded, productId]);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`inline-flex items-center gap-1 text-xs ${
          isDark ? 'text-blue-400 hover:text-blue-300' : 'text-pink-600 hover:text-pink-700'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t.whyRecommended}
      </button>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden ${
      isDark ? 'bg-gray-800/50' : 'bg-gray-50'
    }`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 text-sm font-medium transition-colors ${
          isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {t.whyRecommended}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className={`p-3 pt-0 space-y-3 ${isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t.loading}
              </span>
            </div>
          ) : data ? (
            <>
              {/* マッチスコア */}
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t.matchScore}:
                </span>
                <div className="flex-1 h-2 rounded-full bg-gray-600 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isDark ? 'bg-blue-500' : 'bg-pink-500'
                    }`}
                    style={{ width: `${data.matchScore}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {data.matchScore}%
                </span>
              </div>

              {/* 理由リスト */}
              {data.reasons.length > 0 && (
                <ul className="space-y-1">
                  {data.reasons.map((reason, index) => (
                    <li
                      key={index}
                      className={`text-sm flex items-start gap-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      <span className={isDark ? 'text-green-400' : 'text-green-600'}>✓</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              )}

              {/* マッチしたタグ */}
              {data.matchedTags.length > 0 && (
                <div>
                  <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {t.tags}:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {data.matchedTags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          isDark
                            ? 'bg-blue-600/30 text-blue-300'
                            : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* マッチした出演者 */}
              {data.matchedPerformers.length > 0 && (
                <div>
                  <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {t.performers}:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {data.matchedPerformers.map((performer) => (
                      <span
                        key={performer}
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          isDark
                            ? 'bg-purple-600/30 text-purple-300'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {performer}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {locale === 'ja' ? 'データを取得できませんでした' : 'Unable to fetch data'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default RecommendationReason;
