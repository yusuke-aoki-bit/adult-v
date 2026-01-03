'use client';

import { useState, useEffect, useCallback } from 'react';

export interface HomeSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

/** ページ固有のセクション設定 */
export interface PageSectionConfig {
  pageId: string;
  sections: HomeSection[];
}

const STORAGE_KEY_PREFIX = 'section_preferences';

/** 各ページのデフォルトセクション設定 */
const pageSectionDefaults: Record<string, { ja: HomeSection[]; en: HomeSection[] }> = {
  home: {
    ja: [
      { id: 'sales', label: 'セール情報', visible: true, order: 0 },
      { id: 'ai-search', label: 'AI検索', visible: true, order: 1 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 2 },
      { id: 'profile', label: '好みプロファイル', visible: true, order: 3 },
      { id: 'recommendations', label: 'おすすめ', visible: true, order: 4 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 5 },
      { id: 'trending', label: 'トレンド', visible: true, order: 6 },
      { id: 'new-releases', label: '新作', visible: true, order: 7 },
    ],
    en: [
      { id: 'sales', label: 'Sales', visible: true, order: 0 },
      { id: 'ai-search', label: 'AI Search', visible: true, order: 1 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 2 },
      { id: 'profile', label: 'Preference Profile', visible: true, order: 3 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 4 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 5 },
      { id: 'trending', label: 'Trending', visible: true, order: 6 },
      { id: 'new-releases', label: 'New Releases', visible: true, order: 7 },
    ],
  },
  products: {
    ja: [
      { id: 'filters', label: 'フィルター', visible: true, order: 0 },
      { id: 'sort', label: '並び替え', visible: true, order: 1 },
      { id: 'grid', label: '作品一覧', visible: true, order: 2 },
    ],
    en: [
      { id: 'filters', label: 'Filters', visible: true, order: 0 },
      { id: 'sort', label: 'Sort', visible: true, order: 1 },
      { id: 'grid', label: 'Products', visible: true, order: 2 },
    ],
  },
  discover: {
    ja: [
      { id: 'categories', label: 'カテゴリー', visible: true, order: 0 },
      { id: 'trending', label: 'トレンド', visible: true, order: 1 },
      { id: 'recommendations', label: 'おすすめ', visible: true, order: 2 },
      { id: 'genres', label: 'ジャンル', visible: true, order: 3 },
    ],
    en: [
      { id: 'categories', label: 'Categories', visible: true, order: 0 },
      { id: 'trending', label: 'Trending', visible: true, order: 1 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 2 },
      { id: 'genres', label: 'Genres', visible: true, order: 3 },
    ],
  },
};

// 後方互換性のためのデフォルトセクション
const defaultSections: HomeSection[] = pageSectionDefaults.home.ja;
const defaultSectionsEn: HomeSection[] = pageSectionDefaults.home.en;

export interface UseHomeSectionsOptions {
  locale?: string;
  pageId?: string;
  customSections?: HomeSection[];
}

export function useHomeSections(localeOrOptions: string | UseHomeSectionsOptions = 'ja') {
  // 後方互換性: 文字列の場合はlocaleとして扱う
  const options: UseHomeSectionsOptions = typeof localeOrOptions === 'string'
    ? { locale: localeOrOptions }
    : localeOrOptions;

  const { locale = 'ja', pageId = 'home', customSections } = options;
  const storageKey = `${STORAGE_KEY_PREFIX}_${pageId}`;
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const getDefaultSections = useCallback(() => {
    // カスタムセクションが指定されている場合はそれを使用
    if (customSections) {
      return customSections;
    }
    // ページ固有のデフォルトがあればそれを使用
    const pageDefaults = pageSectionDefaults[pageId];
    if (pageDefaults) {
      return locale === 'ja' ? pageDefaults.ja : pageDefaults.en;
    }
    // フォールバック: ホームページのデフォルト
    return locale === 'ja' ? defaultSections : defaultSectionsEn;
  }, [locale, pageId, customSections]);

  // LocalStorageから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 保存されたセクションと現在のデフォルトをマージ
        const defaults = getDefaultSections();
        const merged = defaults.map(defaultSection => {
          const saved = parsed.find((s: HomeSection) => s.id === defaultSection.id);
          return saved
            ? { ...defaultSection, visible: saved.visible, order: saved.order }
            : defaultSection;
        });
        setSections(merged.sort((a, b) => a.order - b.order));
      } else {
        setSections(getDefaultSections());
      }
    } catch (e) {
      console.error('Failed to load home section preferences:', e);
      setSections(getDefaultSections());
    }
    setIsLoaded(true);
  }, [getDefaultSections, storageKey]);

  // LocalStorageに保存
  const saveSections = useCallback((newSections: HomeSection[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newSections));
    } catch (e) {
      console.error('Failed to save home section preferences:', e);
    }
  }, [storageKey]);

  const toggleVisibility = useCallback((sectionId: string) => {
    setSections(prev => {
      const updated = prev.map(section =>
        section.id === sectionId
          ? { ...section, visible: !section.visible }
          : section
      );
      saveSections(updated);
      return updated;
    });
  }, [saveSections]);

  const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
    setSections(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);

      // orderを再計算
      const reordered = updated.map((section, index) => ({
        ...section,
        order: index,
      }));

      saveSections(reordered);
      return reordered;
    });
  }, [saveSections]);

  const resetToDefault = useCallback(() => {
    const defaults = getDefaultSections();
    setSections(defaults);
    saveSections(defaults);
  }, [getDefaultSections, saveSections]);

  const isSectionVisible = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    return section?.visible ?? true;
  }, [sections]);

  const getSectionOrder = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    return section?.order ?? 0;
  }, [sections]);

  return {
    sections,
    isLoaded,
    toggleVisibility,
    reorderSections,
    resetToDefault,
    isSectionVisible,
    getSectionOrder,
    visibleSections: sections.filter(s => s.visible).sort((a, b) => a.order - b.order),
  };
}

export default useHomeSections;

// ページ固有セクションのデフォルト設定を取得するヘルパー
export function getPageSectionDefaults(pageId: string, locale: string = 'ja'): HomeSection[] {
  const pageDefaults = pageSectionDefaults[pageId];
  if (pageDefaults) {
    return locale === 'ja' ? pageDefaults.ja : pageDefaults.en;
  }
  return locale === 'ja' ? defaultSections : defaultSectionsEn;
}
