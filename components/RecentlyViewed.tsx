'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Clock, X } from 'lucide-react';
import { useRecentlyViewed, RecentlyViewedItem } from '@/hooks/useRecentlyViewed';
import { normalizeImageUrl } from '@/lib/image-utils';
import { providerMeta, type ProviderId } from '@/lib/providers';

const translations = {
  ja: {
    title: '最近見た作品',
    empty: '閲覧履歴はありません',
    clearAll: 'すべて削除',
  },
  en: {
    title: 'Recently Viewed',
    empty: 'No viewing history',
    clearAll: 'Clear all',
  },
  zh: {
    title: '最近浏览',
    empty: '暂无浏览记录',
    clearAll: '全部删除',
  },
  ko: {
    title: '최근 본 작품',
    empty: '조회 기록이 없습니다',
    clearAll: '전체 삭제',
  },
} as const;

const PLACEHOLDER_IMAGE = 'https://placehold.co/80x112/1f2937/ffffff?text=NO+IMAGE';

export default function RecentlyViewed() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { items, isLoading, removeItem, clearAll } = useRecentlyViewed();

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-24 bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-16 sm:w-20">
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t.title}
        </h3>
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {t.clearAll}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {items.slice(0, 10).map((item) => (
          <RecentlyViewedCard
            key={item.id}
            item={item}
            locale={locale}
            onRemove={removeItem}
          />
        ))}
      </div>
    </div>
  );
}

function RecentlyViewedCard({
  item,
  locale,
  onRemove,
}: {
  item: RecentlyViewedItem;
  locale: string;
  onRemove: (id: string) => void;
}) {
  const meta = item.aspName ? providerMeta[item.aspName as ProviderId] : null;
  const imageUrl = item.imageUrl ? normalizeImageUrl(item.imageUrl) : PLACEHOLDER_IMAGE;

  return (
    <div className="relative group flex-shrink-0">
      <Link
        href={`/${locale}/products/${item.id}`}
        className="block w-16 sm:w-20"
      >
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-800">
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            sizes="80px"
            className="object-cover transition-transform group-hover:scale-105"
          />
          {meta && (
            <div
              className={`absolute bottom-0 left-0 right-0 py-0.5 text-center text-[8px] font-bold text-white bg-gradient-to-r ${meta.accentClass}`}
            >
              {meta.label}
            </div>
          )}
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-800 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        aria-label="Remove from history"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
}
