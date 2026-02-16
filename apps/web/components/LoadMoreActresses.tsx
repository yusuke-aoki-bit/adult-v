'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Film } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { generateActressAltText } from '@adult-v/shared/lib/seo-utils';

interface PerformerItem {
  id: number;
  name: string;
  imageUrl: string | null;
  productCount: number;
  debutYear: number | null;
}

interface LoadMoreActressesProps {
  initialPerformers: PerformerItem[];
  totalCount: number;
  perPage: number;
  locale: string;
  sort: string;
  query?: string;
  translations: {
    loading: string;
    loadMore: string;
    allLoaded: string;
  };
}

export default function LoadMoreActresses({
  initialPerformers,
  totalCount,
  perPage,
  locale,
  sort,
  query,
  translations: t,
}: LoadMoreActressesProps) {
  const [performers, setPerformers] = useState<PerformerItem[]>(initialPerformers);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPerformers.length < totalCount);
  const [hasError, setHasError] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 競合状態防止用のref（最新の値を追跡）
  const performersLengthRef = useRef(performers.length);
  performersLengthRef.current = performers.length;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setHasError(false);
    try {
      const nextPage = page + 1;
      const offset = nextPage * perPage; // page=1なら offset=48 (初期表示分の次から)
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(perPage),
        ...(query && { query }),
        ...(sort && { sort }),
      });

      const response = await fetch(`/api/actresses?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const newPerformers = Array.isArray(data.actresses) ? data.actresses : [];

      if (newPerformers.length === 0) {
        setHasMore(false);
      } else {
        setPerformers(prev => [...prev, ...newPerformers]);
        setPage(nextPage);

        // refを使用して最新の値を取得（競合状態防止）
        const totalLoaded = performersLengthRef.current + newPerformers.length;
        if (totalLoaded >= totalCount) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading more actresses:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore, sort, query, perPage, totalCount]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  const remainingCount = totalCount - performers.length;

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
        {performers.map((performer) => (
          <Link
            key={performer.id}
            href={localizedHref(`/actress/${performer.id}`, locale)}
            className="group"
          >
            <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-gray-800 mb-2">
              {performer.imageUrl ? (
                <Image
                  src={performer.imageUrl}
                  alt={generateActressAltText({ name: performer.name, productCount: performer.productCount })}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 12vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-600" />
                </div>
              )}
            </div>
            <h2 className="text-sm font-medium theme-text truncate group-hover:text-pink-400 transition-colors">
              {performer.name}
            </h2>
            <div className="flex items-center gap-2 text-xs theme-text-muted">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {performer.productCount}
              </span>
              {performer.debutYear && (
                <span>{performer.debutYear}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Loading indicator & Load more trigger */}
      <div ref={observerTarget} className="mt-8 flex flex-col items-center gap-4">
        {isLoading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-pink-500 rounded-full animate-spin" />
            <span>{t.loading}</span>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-red-400 text-sm">読み込みに失敗しました</p>
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              再試行
            </button>
          </div>
        )}

        {hasMore && !isLoading && !hasError && (
          <button
            onClick={loadMore}
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 hover:border-pink-500"
          >
            {t.loadMore.replace('{count}', String(Math.min(perPage, remainingCount)))}
          </button>
        )}

        {!hasMore && performers.length > 0 && (
          <p className="text-gray-500 text-sm">
            {t.allLoaded.replace('{count}', String(performers.length))}
          </p>
        )}
      </div>
    </div>
  );
}
