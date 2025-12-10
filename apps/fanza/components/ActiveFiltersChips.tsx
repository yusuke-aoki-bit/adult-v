'use client';

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { useSite } from '@/lib/contexts/SiteContext';

// Client-side translations
const translations = {
  ja: {
    activeFilters: '適用中',
    clearAll: '全解除',
    sale: 'セール中',
    hasVideo: 'サンプル動画あり',
    hasImage: 'サンプル画像あり',
    uncategorized: '未分類',
    solo: 'ソロ',
    multi: '複数出演',
    tag: 'タグ',
  },
  en: {
    activeFilters: 'Active',
    clearAll: 'Clear All',
    sale: 'On Sale',
    hasVideo: 'Has Video',
    hasImage: 'Has Image',
    uncategorized: 'Uncategorized',
    solo: 'Solo',
    multi: 'Multiple',
    tag: 'Tag',
  },
  zh: {
    activeFilters: '筛选中',
    clearAll: '清除全部',
    sale: '特卖中',
    hasVideo: '有样片',
    hasImage: '有样图',
    uncategorized: '未分类',
    solo: '单人',
    multi: '多人',
    tag: '标签',
  },
  ko: {
    activeFilters: '적용중',
    clearAll: '전체 해제',
    sale: '세일 중',
    hasVideo: '샘플 동영상',
    hasImage: '샘플 이미지',
    uncategorized: '미분류',
    solo: '솔로',
    multi: '복수 출연',
    tag: '태그',
  },
} as const;

interface Filter {
  key: string;
  label: string;
  type: 'boolean' | 'asp' | 'tag' | 'performer';
  value?: string;
}

export default function ActiveFiltersChips() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { isFanzaSite } = useSite();

  const activeFilters: Filter[] = [];

  // Boolean filters
  if (searchParams.get('onSale') === 'true') {
    activeFilters.push({ key: 'onSale', label: t.sale, type: 'boolean' });
  }
  if (searchParams.get('hasVideo') === 'true') {
    activeFilters.push({ key: 'hasVideo', label: t.hasVideo, type: 'boolean' });
  }
  if (searchParams.get('hasImage') === 'true') {
    activeFilters.push({ key: 'hasImage', label: t.hasImage, type: 'boolean' });
  }
  if (searchParams.get('uncategorized') === 'true') {
    activeFilters.push({ key: 'uncategorized', label: t.uncategorized, type: 'boolean' });
  }

  // Performer type
  const performerType = searchParams.get('performerType');
  if (performerType === 'solo') {
    activeFilters.push({ key: 'performerType', label: t.solo, type: 'performer' });
  } else if (performerType === 'multi') {
    activeFilters.push({ key: 'performerType', label: t.multi, type: 'performer' });
  }

  // ASP filters - FANZAサイトでは非表示（ASPフィルター自体がないため）
  if (!isFanzaSite) {
    const includeAsp = searchParams.get('includeAsp');
    if (includeAsp) {
      includeAsp.split(',').forEach(asp => {
        const providerId = ASP_TO_PROVIDER_ID[asp];
        const meta = providerId ? providerMeta[providerId] : null;
        activeFilters.push({
          key: `asp-${asp}`,
          label: meta?.label || asp,
          type: 'asp',
          value: asp,
        });
      });
    }
  }

  // Tag filters
  const includeTags = searchParams.get('include');
  if (includeTags) {
    includeTags.split(',').forEach(tag => {
      activeFilters.push({
        key: `tag-${tag}`,
        label: tag,
        type: 'tag',
        value: tag,
      });
    });
  }

  if (activeFilters.length === 0) return null;

  const removeFilter = (filter: Filter) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (filter.type === 'asp' && filter.value) {
      const values = newParams.get('includeAsp')?.split(',') || [];
      const filtered = values.filter(v => v !== filter.value);
      if (filtered.length > 0) {
        newParams.set('includeAsp', filtered.join(','));
      } else {
        newParams.delete('includeAsp');
      }
    } else if (filter.type === 'tag' && filter.value) {
      const values = newParams.get('include')?.split(',') || [];
      const filtered = values.filter(v => v !== filter.value);
      if (filtered.length > 0) {
        newParams.set('include', filtered.join(','));
      } else {
        newParams.delete('include');
      }
    } else {
      newParams.delete(filter.key);
    }

    newParams.delete('page');
    router.push(`?${newParams.toString()}`);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams();
    // Keep only sort and limit
    const sort = searchParams.get('sort');
    const limit = searchParams.get('limit');
    if (sort) newParams.set('sort', sort);
    if (limit) newParams.set('limit', limit);
    router.push(`?${newParams.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-3 mb-2 bg-gray-800/50 rounded-lg border-l-4 border-rose-500 transition-all">
      <span className="text-xs text-gray-300 font-medium">{t.activeFilters}:</span>
      {activeFilters.map(filter => (
        <button
          key={filter.key}
          onClick={() => removeFilter(filter)}
          className="inline-flex items-center gap-1 bg-rose-600/80 hover:bg-rose-700 text-white text-xs px-2 py-1 rounded-full transition-colors group"
          aria-label={`${filter.label}を削除`}
        >
          <span>{filter.label}</span>
          <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
      {activeFilters.length > 1 && (
        <button
          onClick={clearAllFilters}
          className="text-xs text-gray-400 hover:text-white underline transition-colors ml-1"
        >
          {t.clearAll}
        </button>
      )}
    </div>
  );
}
