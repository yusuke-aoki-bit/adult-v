'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, TrendingUp, Film, Calendar, Loader2, ChevronRight } from 'lucide-react';
import { normalizeImageUrl } from '../../lib/image-utils';

interface RookiePerformer {
  id: number;
  name: string;
  imageUrl: string | null;
  debutYear: number;
  productCount: number;
  latestProductTitle: string | null;
  latestProductDate: string | null;
}

interface RookieRankingProps {
  locale?: string;
  theme?: 'light' | 'dark';
  limit?: number;
  showViewAll?: boolean;
}

const translations = {
  ja: {
    title: '注目の新人',
    subtitle: '今年・昨年デビューの注目演者',
    viewAll: 'すべて見る',
    products: '作品',
    debut: 'デビュー',
    latestWork: '最新作',
    noRookies: '新人データがありません',
    loading: '読み込み中...',
    error: 'エラーが発生しました',
  },
  en: {
    title: 'Rising Stars',
    subtitle: 'Spotlight on recent debuts',
    viewAll: 'View All',
    products: 'products',
    debut: 'Debut',
    latestWork: 'Latest',
    noRookies: 'No rookie data available',
    loading: 'Loading...',
    error: 'An error occurred',
  },
  zh: {
    title: '新人推荐',
    subtitle: '今年和去年出道的新人',
    viewAll: '查看全部',
    products: '作品',
    debut: '出道',
    latestWork: '最新作',
    noRookies: '暂无新人数据',
    loading: '加载中...',
    error: '发生错误',
  },
  ko: {
    title: '떠오르는 신인',
    subtitle: '올해와 작년 데뷔한 배우',
    viewAll: '모두 보기',
    products: '작품',
    debut: '데뷔',
    latestWork: '최신작',
    noRookies: '신인 데이터 없음',
    loading: '로딩 중...',
    error: '오류가 발생했습니다',
  },
} as const;

export function RookieRanking({
  locale = 'ja',
  theme = 'dark',
  limit = 10,
  showViewAll = true,
}: RookieRankingProps) {
  const [performers, setPerformers] = useState<RookiePerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    card: theme === 'dark' ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100',
    badge: theme === 'dark' ? 'bg-pink-900/50 text-pink-300' : 'bg-pink-100 text-pink-700',
    rankBadge: theme === 'dark'
      ? ['bg-yellow-500/20 text-yellow-400', 'bg-gray-400/20 text-gray-300', 'bg-amber-700/20 text-amber-500']
      : ['bg-yellow-100 text-yellow-700', 'bg-gray-200 text-gray-600', 'bg-amber-100 text-amber-700'],
  };

  useEffect(() => {
    const fetchRookies = async () => {
      try {
        const response = await fetch(`/api/ranking/rookies?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setPerformers(data.performers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRookies();
  }, [limit]);

  if (isLoading) {
    return (
      <div className={`rounded-lg border p-6 ${themeClasses.container}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className={`w-8 h-8 animate-spin ${themeClasses.textMuted}`} />
          <span className={`ml-2 ${themeClasses.textMuted}`}>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 ${themeClasses.container}`}>
        <p className={`text-center ${themeClasses.textMuted}`}>{t.error}</p>
      </div>
    );
  }

  if (performers.length === 0) {
    return (
      <div className={`rounded-lg border p-6 ${themeClasses.container}`}>
        <p className={`text-center ${themeClasses.textMuted}`}>{t.noRookies}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 sm:p-6 ${themeClasses.container}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`text-xl font-bold flex items-center gap-2 ${themeClasses.text}`}>
            <Sparkles className="w-5 h-5 text-pink-500" />
            {t.title}
          </h2>
          <p className={`text-sm ${themeClasses.textMuted}`}>{t.subtitle}</p>
        </div>
        {showViewAll && (
          <Link
            href={`/${locale}/discover?filter=rookies`}
            className={`flex items-center gap-1 text-sm font-medium ${
              theme === 'dark' ? 'text-pink-400 hover:text-pink-300' : 'text-pink-600 hover:text-pink-700'
            }`}
          >
            {t.viewAll}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Performer Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {performers.map((performer, index) => (
          <Link
            key={performer['id']}
            href={`/${locale}/actress/${performer['id']}`}
            className={`rounded-lg overflow-hidden transition-all ${themeClasses.card}`}
          >
            {/* Image */}
            <div className="relative" style={{ aspectRatio: '3/4' }}>
              {performer.imageUrl ? (
                <Image
                  src={normalizeImageUrl(performer.imageUrl)}
                  alt={performer['name']}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <span className={themeClasses.textMuted}>No Image</span>
                </div>
              )}

              {/* Rank Badge */}
              {index < 3 && (
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  themeClasses.rankBadge[index]
                }`}>
                  #{index + 1}
                </div>
              )}

              {/* Debut Year Badge */}
              <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${themeClasses.badge}`}>
                {performer['debutYear']}
              </div>
            </div>

            {/* Info */}
            <div className="p-2">
              <h3 className={`font-medium text-sm truncate ${themeClasses.text}`}>
                {performer['name']}
              </h3>
              <div className={`flex items-center gap-2 mt-1 text-xs ${themeClasses.textMuted}`}>
                <span className="flex items-center gap-0.5">
                  <Film className="w-3 h-3" />
                  {performer.productCount} {t.products}
                </span>
              </div>
              {performer.latestProductTitle && (
                <p className={`text-xs mt-1 truncate ${themeClasses.textMuted}`}>
                  {t.latestWork}: {performer.latestProductTitle}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
