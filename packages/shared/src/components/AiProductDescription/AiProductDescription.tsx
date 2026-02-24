'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, aiProductDescriptionTranslations } from '../../lib/translations';

interface AiDescription {
  shortDescription: string;
  longDescription: string;
  catchphrase: string;
  highlights: string[];
  targetAudience: string;
}

interface AiProductDescriptionProps {
  productId: string;
  locale?: string;
  theme?: 'dark' | 'light';
  apiEndpoint?: string;
  /** @deprecated AI説明はシステム事前生成のため、自動的に読み込まれます */
  autoLoad?: boolean;
}

/**
 * AI作品説明表示コンポーネント
 *
 * 説明はシステム側で事前生成されます。
 * このコンポーネントは事前生成された説明を取得して表示するのみです。
 * 説明がまだ生成されていない場合は何も表示しません。
 */
export function AiProductDescription({
  productId,
  locale = 'ja',
  theme: themeProp,
  apiEndpoint,
}: AiProductDescriptionProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [description, setDescription] = useState<AiDescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const t = getTranslation(aiProductDescriptionTranslations, locale);

  // APIエンドポイント - 事前生成された説明を取得
  const endpoint = apiEndpoint || `/api/products/${productId}/ai-description`;

  const fetchDescription = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setDescription(data);
      }
      // 404の場合は説明がまだ生成されていない - 何も表示しない
    } catch {
      // エラー時も何も表示しない
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  // 自動的に読み込み
  useEffect(() => {
    fetchDescription();
  }, [fetchDescription]);

  const baseClass = theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200';

  const textClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-700';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  // Loading state
  if (isLoading) {
    return (
      <div className={`rounded-lg border p-4 ${baseClass} flex items-center justify-center gap-2`}>
        <div
          className={`h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${mutedClass}`}
        />
        <span className={mutedClass}>{t.loading}</span>
      </div>
    );
  }

  // 説明がない場合は何も表示しない
  if (!description) return null;

  return (
    <div className={`rounded-lg border ${baseClass} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex w-full items-center justify-between px-4 py-3 ${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className={`font-medium ${textClass}`}>{t.title}</span>
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${mutedClass} ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="space-y-4 px-4 pb-4">
          {/* Catchphrase */}
          {description.catchphrase && (
            <div className="text-center">
              <p className={`text-lg font-medium ${textClass} italic`}>「{description.catchphrase}」</p>
            </div>
          )}

          {/* Short description */}
          <p className={textClass}>{description.shortDescription}</p>

          {/* Long description */}
          <p className={`text-sm ${mutedClass}`}>{description.longDescription}</p>

          {/* Highlights */}
          {description.highlights && description.highlights.length > 0 && (
            <div>
              <h4 className={`mb-2 text-sm font-medium ${mutedClass}`}>{t.highlights}</h4>
              <ul className="space-y-1">
                {description.highlights.map((highlight, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${textClass}`}>
                    <span className="mt-0.5 text-fuchsia-400">✓</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Target audience */}
          {description.targetAudience && (
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <h4 className={`mb-1 text-xs font-medium ${mutedClass}`}>{t.targetAudience}</h4>
              <p className={`text-sm ${textClass}`}>{description.targetAudience}</p>
            </div>
          )}
        </div>
      )}

      {/* Collapsed preview */}
      {!isExpanded && description.shortDescription && (
        <div className="px-4 pb-3">
          <p className={`text-sm ${mutedClass} line-clamp-2`}>{description.shortDescription}</p>
        </div>
      )}
    </div>
  );
}
