/**
 * Filter component translations.
 * Migrated from components/filters/translations.ts into the centralized system.
 */

// ============================================================
// ProductSortDropdown
// ============================================================
export const sortTranslations = {
  ja: {
    sortLabel: '並び順:',
    releaseDateDesc: '新しい順',
    releaseDateAsc: '古い順',
    priceAsc: '価格が安い順',
    priceDesc: '価格が高い順',
    ratingDesc: '評価が高い順',
    reviewCountDesc: 'レビュー数順',
    durationDesc: '再生時間が長い順',
    durationAsc: '再生時間が短い順',
    titleAsc: 'タイトル順',
    random: 'ランダム',
  },
  en: {
    sortLabel: 'Sort:',
    releaseDateDesc: 'Newest First',
    releaseDateAsc: 'Oldest First',
    priceAsc: 'Price: Low to High',
    priceDesc: 'Price: High to Low',
    ratingDesc: 'Highest Rated',
    reviewCountDesc: 'Most Reviews',
    durationDesc: 'Longest Duration',
    durationAsc: 'Shortest Duration',
    titleAsc: 'Title (A-Z)',
    random: 'Random',
  },
  zh: {
    sortLabel: '排序:',
    releaseDateDesc: '最新优先',
    releaseDateAsc: '最早优先',
    priceAsc: '价格：从低到高',
    priceDesc: '价格：从高到低',
    ratingDesc: '评分最高',
    reviewCountDesc: '评论最多',
    durationDesc: '时长最长',
    durationAsc: '时长最短',
    titleAsc: '标题 (A-Z)',
    random: '随机',
  },
  'zh-TW': {
    sortLabel: '排序:',
    releaseDateDesc: '最新優先',
    releaseDateAsc: '最早優先',
    priceAsc: '價格：從低到高',
    priceDesc: '價格：從高到低',
    ratingDesc: '評分最高',
    reviewCountDesc: '評論最多',
    durationDesc: '時長最長',
    durationAsc: '時長最短',
    titleAsc: '標題 (A-Z)',
    random: '隨機',
  },
  ko: {
    sortLabel: '정렬:',
    releaseDateDesc: '최신순',
    releaseDateAsc: '오래된순',
    priceAsc: '가격: 낮은순',
    priceDesc: '가격: 높은순',
    ratingDesc: '평점 높은순',
    reviewCountDesc: '리뷰 많은순',
    durationDesc: '재생시간 긴순',
    durationAsc: '재생시간 짧은순',
    titleAsc: '제목순 (가나다)',
    random: '랜덤',
  },
} as const;

// ============================================================
// PerPageDropdown
// ============================================================
export const perPageTranslations = {
  ja: {
    perPageLabel: '表示件数:',
    items: '件',
  },
  en: {
    perPageLabel: 'Per Page:',
    items: '',
  },
  zh: {
    perPageLabel: '每页显示:',
    items: '件',
  },
  'zh-TW': {
    perPageLabel: '每頁顯示:',
    items: '件',
  },
  ko: {
    perPageLabel: '페이지당:',
    items: '개',
  },
} as const;

// ============================================================
// ActiveFiltersChips
// ============================================================
export const activeFiltersTranslations = {
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
  'zh-TW': {
    activeFilters: '篩選中',
    clearAll: '清除全部',
    sale: '特賣中',
    hasVideo: '有樣片',
    hasImage: '有樣圖',
    uncategorized: '未分類',
    solo: '單人',
    multi: '多人',
    tag: '標籤',
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

// ============================================================
// Type exports
// ============================================================
export type SortTranslationKey = keyof typeof sortTranslations.ja;
export type PerPageTranslationKey = keyof typeof perPageTranslations.ja;
export type ActiveFiltersTranslationKey = keyof typeof activeFiltersTranslations.ja;
export type SupportedLocale = 'ja' | 'en' | 'zh' | 'zh-TW' | 'ko';

// ============================================================
// Helper functions (backward compatibility)
// ============================================================
/** @deprecated Use `getTranslation(sortTranslations, locale)` instead. */
export function getSortTranslation(locale: string) {
  return sortTranslations[locale as SupportedLocale] || sortTranslations.ja;
}

/** @deprecated Use `getTranslation(perPageTranslations, locale)` instead. */
export function getPerPageTranslation(locale: string) {
  return perPageTranslations[locale as SupportedLocale] || perPageTranslations.ja;
}

/** @deprecated Use `getTranslation(activeFiltersTranslations, locale)` instead. */
export function getActiveFiltersTranslation(locale: string) {
  return activeFiltersTranslations[locale as SupportedLocale] || activeFiltersTranslations.ja;
}
