'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, User, ChevronDown, ChevronUp } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';

interface RecommendedActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  matchScore: number;
  matchReasons: string[];
  genreMatchPercent: number;
  sharedCoStars: number;
}

interface ActressRecommendationsProps {
  favoritePerformerIds: string[];
  locale: string;
}

const translations = {
  ja: {
    title: 'この女優が好きなら',
    subtitle: 'お気に入り女優の傾向からおすすめ',
    loading: '分析中...',
    noRecommendations: 'お気に入り女優を追加すると、おすすめが表示されます',
    products: '作品',
    coStarred: '回共演',
    genreMatch: 'ジャンル一致',
    showMore: 'もっと見る',
    showLess: '閉じる',
  },
  en: {
    title: 'If you like these actresses',
    subtitle: 'Recommendations based on your favorites',
    loading: 'Analyzing...',
    noRecommendations: 'Add favorite actresses to see recommendations',
    products: 'works',
    coStarred: 'co-starred',
    genreMatch: 'genre match',
    showMore: 'Show more',
    showLess: 'Show less',
  },
  zh: {
    title: '喜欢这些女优的话',
    subtitle: '根据您的收藏推荐',
    loading: '分析中...',
    noRecommendations: '添加收藏女优以查看推荐',
    products: '作品',
    coStarred: '次共演',
    genreMatch: '类型匹配',
    showMore: '显示更多',
    showLess: '收起',
  },
  'zh-TW': {
    title: '喜歡這些女優的話',
    subtitle: '根據您的收藏推薦',
    loading: '分析中...',
    noRecommendations: '新增收藏女優以查看推薦',
    products: '作品',
    coStarred: '次共演',
    genreMatch: '類型匹配',
    showMore: '顯示更多',
    showLess: '收起',
  },
  ko: {
    title: '이 여배우를 좋아하신다면',
    subtitle: '즐겨찾기 여배우 기반 추천',
    loading: '분석 중...',
    noRecommendations: '여배우를 즐겨찾기에 추가하면 추천이 표시됩니다',
    products: '작품',
    coStarred: '회 공연',
    genreMatch: '장르 일치',
    showMore: '더 보기',
    showLess: '접기',
  },
} as const;

export default function ActressRecommendations({ favoritePerformerIds, locale }: ActressRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedActress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const t = translations[locale as keyof typeof translations] || translations['ja'];

  // 配列の参照ではなく内容で比較するためにシリアライズ
  const idsKey = JSON.stringify(favoritePerformerIds.slice().sort());
  const prevIdsKey = useRef<string>('');

  useEffect(() => {
    // IDが実際に変わった場合のみfetch
    if (idsKey === prevIdsKey.current) {
      return;
    }
    prevIdsKey.current = idsKey;

    async function fetchRecommendations() {
      if (favoritePerformerIds.length === 0) {
        setRecommendations([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/recommendations/actresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performerIds: favoritePerformerIds.map((id) => parseInt(id)),
            limit: 12,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error('Failed to fetch actress recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, [idsKey, favoritePerformerIds]);

  if (favoritePerformerIds.length === 0) {
    return null;
  }

  const displayedRecommendations = showAll ? recommendations : recommendations.slice(0, 6);

  return (
    <div className="rounded-xl border border-purple-500/20 bg-linear-to-r from-purple-900/30 to-fuchsia-900/30 p-4 sm:p-6">
      {/* Header */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="mb-4 flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-500/20 p-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white">{t.title}</h3>
            <p className="text-sm text-gray-400">{t.subtitle}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-lg bg-gray-800/50">
                  <div className="aspect-square bg-gray-700" />
                  <div className="space-y-1 p-2">
                    <div className="h-3 w-3/4 rounded bg-gray-700" />
                    <div className="h-2 w-1/2 rounded bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <p className="py-8 text-center text-gray-400">{t.noRecommendations}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {displayedRecommendations.map((actress) => (
                  <Link
                    key={actress.id}
                    href={localizedHref(`/actress/${actress.id}`, locale)}
                    className="group overflow-hidden rounded-lg bg-gray-800/50 transition-all hover:ring-2 hover:ring-purple-500/50"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-gray-700">
                      {actress.heroImageUrl || actress.thumbnailUrl ? (
                        <Image
                          src={normalizeImageUrl(actress.heroImageUrl || actress.thumbnailUrl)}
                          alt={actress.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <User className="h-12 w-12 text-gray-600" />
                        </div>
                      )}

                      {/* Match Score Badge */}
                      {actress.genreMatchPercent >= 50 && (
                        <div className="absolute top-1 right-1 rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {actress.genreMatchPercent}%
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <h4 className="truncate text-sm font-medium text-white transition-colors group-hover:text-purple-300">
                        {actress.name}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {actress.productCount} {t.products}
                      </p>

                      {/* Match Reasons */}
                      {actress.matchReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {actress.matchReasons.slice(0, 2).map((reason, i) => (
                            <span
                              key={i}
                              className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Show more/less button */}
              {recommendations.length > 6 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="mx-auto flex items-center gap-1 text-sm font-medium text-purple-400 hover:text-purple-300"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        {t.showLess}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        {t.showMore} ({recommendations.length - 6})
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
