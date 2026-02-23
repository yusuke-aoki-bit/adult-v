'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, trendAnalysisTranslations } from '../../lib/translations';

interface TrendItem {
  name: string;
  count: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendsData {
  success: boolean;
  period: string;
  tags: TrendItem[];
  performers: TrendItem[];
  insights: string[];
}

interface TrendAnalysisProps {
  locale: string;
  theme?: 'light' | 'dark';
  onTagClick?: (tag: string) => void;
  onPerformerClick?: (performer: string) => void;
}


export function TrendAnalysis({ locale, theme: themeProp, onTagClick, onPerformerClick }: TrendAnalysisProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const tt = getTranslation(trendAnalysisTranslations, locale);
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [activeTab, setActiveTab] = useState<'tags' | 'performers'>('tags');
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isDark = theme === 'dark';

  // リトライハンドラー
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setHasFetched(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // 遅延フェッチ: 展開されたときのみデータを取得
  useEffect(() => {
    if (!isExpanded) return;

    const fetchTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/trends?period=${period}&locale=${locale}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
          setHasFetched(true);
        } else {
          throw new Error('Failed to fetch trends');
        }
      } catch (err) {
        console.error('Failed to fetch trends:', err);
        setError(tt.fetchError);
      } finally {
        setLoading(false);
        setIsRetrying(false);
      }
    };

    fetchTrends();
  }, [period, locale, isExpanded, retryCount]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsExpanded((prev) => !prev);
    }
  }, []);

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') {
      return (
        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    if (trend === 'down') {
      return (
        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  };

  // フェッチ後にデータがなければ非表示（ただしエラー時はリトライUIを表示）
  if (hasFetched && !data && !loading && !error) {
    return null;
  }

  const renderContent = () => {
    // エラー時はリトライボタンを表示
    if (error) {
      return (
        <div
          className={`flex flex-col items-center justify-center rounded-lg px-4 py-8 ${
            isDark ? 'bg-gray-800/50' : 'bg-gray-100'
          }`}
        >
          <AlertCircle className={`mb-3 h-8 w-8 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`mb-4 text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{error}</p>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isDark
                ? 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-gray-600'
                : 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-gray-400'
            } disabled:cursor-not-allowed`}
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? tt.retrying : tt.retry}
          </button>
        </div>
      );
    }

    // ローディング中
    if (loading || !data) {
      return (
        <div className="flex items-center justify-center gap-2 py-8">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{tt.loading}</span>
        </div>
      );
    }

    return (
      <>
        {/* Period selector and Insights */}
        <div className={`mb-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="mb-3 flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPeriod('week');
              }}
              className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                period === 'week'
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-pink-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tt.week}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPeriod('month');
              }}
              className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                period === 'month'
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-pink-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tt.month}
            </button>
          </div>

          {/* Insights */}
          {data.insights.length > 0 && (
            <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <ul className="space-y-1">
                {data.insights.map((insight, index) => (
                  <li
                    key={index}
                    className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    <span className={isDark ? 'text-yellow-400' : 'text-yellow-600'}>•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className={`mb-4 flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('tags');
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'tags'
                ? isDark
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'border-b-2 border-pink-600 text-pink-600'
                : isDark
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tt.genres}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('performers');
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'performers'
                ? isDark
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'border-b-2 border-pink-600 text-pink-600'
                : isDark
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tt.actresses}
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {(activeTab === 'tags' ? data.tags : data.performers).map((item, index) => (
            <div
              key={item['name']}
              className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => (activeTab === 'tags' ? onTagClick?.(item['name']) : onPerformerClick?.(item['name']))}
            >
              {/* Rank */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  index < 3
                    ? isDark
                      ? 'bg-yellow-600 text-white'
                      : 'bg-yellow-500 text-white'
                    : isDark
                      ? 'bg-gray-700 text-gray-400'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item['name']}</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item['count']} {tt.releases}
                </p>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-1">
                <TrendIcon trend={item.trend} />
                <span
                  className={`text-sm font-medium ${
                    item.trend === 'up' ? 'text-green-500' : item.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  {item.change > 0 ? '+' : ''}
                  {item.change}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={`overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'border border-gray-200 bg-white'}`}>
      {/* Collapsible Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`flex w-full cursor-pointer items-center justify-between p-4 transition-colors ${
          isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
        }`}
      >
        <h3 className={`flex items-center gap-2 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <TrendingUp className="h-5 w-5" />
          {tt.trendAnalysis}
        </h3>
        {isExpanded ? (
          <ChevronUp className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
        ) : (
          <ChevronDown className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className={`border-t p-4 pt-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{renderContent()}</div>
      )}
    </div>
  );
}

export default TrendAnalysis;
