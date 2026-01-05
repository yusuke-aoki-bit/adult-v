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
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 2 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 3 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 4 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 5 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 6 },
      { id: 'fanza-site', label: 'FANZA専門サイト', visible: true, order: 7 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 2 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 3 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 4 },
      { id: 'all-products', label: 'All Products', visible: true, order: 5 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 6 },
      { id: 'fanza-site', label: 'FANZA Site', visible: true, order: 7 },
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
  product: {
    ja: [
      { id: 'sample-video', label: 'サンプル動画', visible: true, order: 0 },
      { id: 'product-info', label: '商品情報', visible: true, order: 1 },
      { id: 'price-comparison', label: '価格比較', visible: true, order: 2 },
      { id: 'cost-performance', label: 'コスパ分析', visible: true, order: 3 },
      { id: 'ai-review', label: 'AIレビュー', visible: true, order: 4 },
      { id: 'scene-timeline', label: 'シーン情報', visible: true, order: 5 },
      { id: 'performer-products', label: '出演者の他作品', visible: true, order: 6 },
      { id: 'series-products', label: '同シリーズ', visible: true, order: 7 },
      { id: 'maker-products', label: '同メーカー', visible: true, order: 8 },
      { id: 'similar-network', label: '類似作品', visible: true, order: 9 },
      { id: 'also-viewed', label: 'よく一緒に見られる', visible: true, order: 10 },
      { id: 'user-contributions', label: 'ユーザー投稿', visible: true, order: 11 },
    ],
    en: [
      { id: 'sample-video', label: 'Sample Video', visible: true, order: 0 },
      { id: 'product-info', label: 'Product Info', visible: true, order: 1 },
      { id: 'price-comparison', label: 'Price Comparison', visible: true, order: 2 },
      { id: 'cost-performance', label: 'Value Analysis', visible: true, order: 3 },
      { id: 'ai-review', label: 'AI Review', visible: true, order: 4 },
      { id: 'scene-timeline', label: 'Scene Timeline', visible: true, order: 5 },
      { id: 'performer-products', label: 'More by Performer', visible: true, order: 6 },
      { id: 'series-products', label: 'Same Series', visible: true, order: 7 },
      { id: 'maker-products', label: 'Same Maker', visible: true, order: 8 },
      { id: 'similar-network', label: 'Similar Products', visible: true, order: 9 },
      { id: 'also-viewed', label: 'Also Viewed', visible: true, order: 10 },
      { id: 'user-contributions', label: 'User Contributions', visible: true, order: 11 },
    ],
  },
  actress: {
    ja: [
      { id: 'profile', label: 'プロフィール', visible: true, order: 0 },
      { id: 'ai-review', label: 'AIレビュー', visible: true, order: 1 },
      { id: 'career', label: 'キャリア分析', visible: true, order: 2 },
      { id: 'top-products', label: '人気作品', visible: true, order: 3 },
      { id: 'on-sale', label: 'セール中', visible: true, order: 4 },
      { id: 'filmography', label: '全作品', visible: true, order: 5 },
      { id: 'costar-network', label: '共演者マップ', visible: true, order: 6 },
      { id: 'similar-network', label: '類似女優', visible: true, order: 7 },
    ],
    en: [
      { id: 'profile', label: 'Profile', visible: true, order: 0 },
      { id: 'ai-review', label: 'AI Review', visible: true, order: 1 },
      { id: 'career', label: 'Career Analysis', visible: true, order: 2 },
      { id: 'top-products', label: 'Top Products', visible: true, order: 3 },
      { id: 'on-sale', label: 'On Sale', visible: true, order: 4 },
      { id: 'filmography', label: 'Filmography', visible: true, order: 5 },
      { id: 'costar-network', label: 'Co-star Network', visible: true, order: 6 },
      { id: 'similar-network', label: 'Similar Actresses', visible: true, order: 7 },
    ],
  },
  statistics: {
    ja: [
      { id: 'overview', label: '概要', visible: true, order: 0 },
      { id: 'monthly-releases', label: '月別リリース', visible: true, order: 1 },
      { id: 'yearly-stats', label: '年別統計', visible: true, order: 2 },
      { id: 'top-performers', label: '女優ランキング', visible: true, order: 3 },
      { id: 'top-genres', label: 'ジャンルランキング', visible: true, order: 4 },
      { id: 'maker-share', label: 'メーカーシェア', visible: true, order: 5 },
      { id: 'genre-trends', label: 'ジャンルトレンド', visible: true, order: 6 },
      { id: 'debut-trends', label: 'デビュー統計', visible: true, order: 7 },
    ],
    en: [
      { id: 'overview', label: 'Overview', visible: true, order: 0 },
      { id: 'monthly-releases', label: 'Monthly Releases', visible: true, order: 1 },
      { id: 'yearly-stats', label: 'Yearly Stats', visible: true, order: 2 },
      { id: 'top-performers', label: 'Top Performers', visible: true, order: 3 },
      { id: 'top-genres', label: 'Top Genres', visible: true, order: 4 },
      { id: 'maker-share', label: 'Maker Share', visible: true, order: 5 },
      { id: 'genre-trends', label: 'Genre Trends', visible: true, order: 6 },
      { id: 'debut-trends', label: 'Debut Trends', visible: true, order: 7 },
    ],
  },
  categories: {
    ja: [
      { id: 'genre', label: 'ジャンル', visible: true, order: 0 },
      { id: 'situation', label: 'シチュエーション', visible: true, order: 1 },
      { id: 'play', label: 'プレイ', visible: true, order: 2 },
      { id: 'body', label: '体型', visible: true, order: 3 },
      { id: 'costume', label: 'コスチューム', visible: true, order: 4 },
      { id: 'other', label: 'その他', visible: true, order: 5 },
    ],
    en: [
      { id: 'genre', label: 'Genre', visible: true, order: 0 },
      { id: 'situation', label: 'Situation', visible: true, order: 1 },
      { id: 'play', label: 'Play', visible: true, order: 2 },
      { id: 'body', label: 'Body Type', visible: true, order: 3 },
      { id: 'costume', label: 'Costume', visible: true, order: 4 },
      { id: 'other', label: 'Other', visible: true, order: 5 },
    ],
  },
  discover: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'discover-main', label: '発掘モード', visible: true, order: 2 },
      { id: 'filters', label: 'フィルター', visible: true, order: 3 },
      { id: 'history', label: '履歴', visible: true, order: 4 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 5 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 6 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 7 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 8 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 9 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'discover-main', label: 'Discover', visible: true, order: 2 },
      { id: 'filters', label: 'Filters', visible: true, order: 3 },
      { id: 'history', label: 'History', visible: true, order: 4 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 5 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 6 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 7 },
      { id: 'all-products', label: 'All Products', visible: true, order: 8 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 9 },
    ],
  },
  series: {
    ja: [
      { id: 'series-info', label: 'シリーズ情報', visible: true, order: 0 },
      { id: 'products', label: '作品一覧', visible: true, order: 1 },
    ],
    en: [
      { id: 'series-info', label: 'Series Info', visible: true, order: 0 },
      { id: 'products', label: 'Products', visible: true, order: 1 },
    ],
  },
  maker: {
    ja: [
      { id: 'maker-info', label: 'メーカー情報', visible: true, order: 0 },
      { id: 'yearly-chart', label: '年別作品数', visible: true, order: 1 },
      { id: 'products', label: '最新作品', visible: true, order: 2 },
      { id: 'popular-performers', label: '人気女優', visible: true, order: 3 },
      { id: 'popular-genres', label: '人気ジャンル', visible: true, order: 4 },
    ],
    en: [
      { id: 'maker-info', label: 'Maker Info', visible: true, order: 0 },
      { id: 'yearly-chart', label: 'Yearly Products', visible: true, order: 1 },
      { id: 'products', label: 'Latest Products', visible: true, order: 2 },
      { id: 'popular-performers', label: 'Popular Performers', visible: true, order: 3 },
      { id: 'popular-genres', label: 'Popular Genres', visible: true, order: 4 },
    ],
  },
  compare: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'product-search', label: '作品検索', visible: true, order: 2 },
      { id: 'selected-products', label: '選択中の作品', visible: true, order: 3 },
      { id: 'comparison', label: '比較表', visible: true, order: 4 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 5 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 6 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 7 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 8 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 9 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'product-search', label: 'Product Search', visible: true, order: 2 },
      { id: 'selected-products', label: 'Selected Products', visible: true, order: 3 },
      { id: 'comparison', label: 'Comparison', visible: true, order: 4 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 5 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 6 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 7 },
      { id: 'all-products', label: 'All Products', visible: true, order: 8 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 9 },
    ],
  },
  'compare-performers': {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'performer-search', label: '女優検索', visible: true, order: 2 },
      { id: 'selected-performers', label: '選択中の女優', visible: true, order: 3 },
      { id: 'comparison', label: '比較表', visible: true, order: 4 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 5 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 6 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 7 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 8 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 9 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'performer-search', label: 'Performer Search', visible: true, order: 2 },
      { id: 'selected-performers', label: 'Selected Performers', visible: true, order: 3 },
      { id: 'comparison', label: 'Comparison', visible: true, order: 4 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 5 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 6 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 7 },
      { id: 'all-products', label: 'All Products', visible: true, order: 8 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 9 },
    ],
  },
  favorites: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'favorites-main', label: 'お気に入り', visible: true, order: 2 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 3 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 4 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 5 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 6 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 7 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'favorites-main', label: 'Favorites', visible: true, order: 2 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 3 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 4 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 5 },
      { id: 'all-products', label: 'All Products', visible: true, order: 6 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 7 },
    ],
  },
  watchlist: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'watchlist-main', label: '後で見る', visible: true, order: 2 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 3 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 4 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 5 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 6 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 7 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'watchlist-main', label: 'Watch Later', visible: true, order: 2 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 3 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 4 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 5 },
      { id: 'all-products', label: 'All Products', visible: true, order: 6 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 7 },
    ],
  },
  diary: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'diary-main', label: '視聴日記', visible: true, order: 2 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 3 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 4 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 5 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 6 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 7 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'diary-main', label: 'Viewing Diary', visible: true, order: 2 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 3 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 4 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 5 },
      { id: 'all-products', label: 'All Products', visible: true, order: 6 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 7 },
    ],
  },
  profile: {
    ja: [
      { id: 'sale', label: 'セール中', visible: true, order: 0 },
      { id: 'recently-viewed', label: '最近見た作品', visible: true, order: 1 },
      { id: 'profile-main', label: 'DNA分析', visible: true, order: 2 },
      { id: 'recommendations', label: 'あなたへのおすすめ', visible: true, order: 3 },
      { id: 'weekly-highlights', label: '今週の注目', visible: true, order: 4 },
      { id: 'trending', label: 'トレンド分析', visible: true, order: 5 },
      { id: 'all-products', label: '全作品一覧', visible: true, order: 6 },
      { id: 'uncategorized', label: '出演者情報が未整理の作品', visible: true, order: 7 },
    ],
    en: [
      { id: 'sale', label: 'On Sale', visible: true, order: 0 },
      { id: 'recently-viewed', label: 'Recently Viewed', visible: true, order: 1 },
      { id: 'profile-main', label: 'DNA Analysis', visible: true, order: 2 },
      { id: 'recommendations', label: 'Recommendations', visible: true, order: 3 },
      { id: 'weekly-highlights', label: 'Weekly Highlights', visible: true, order: 4 },
      { id: 'trending', label: 'Trend Analysis', visible: true, order: 5 },
      { id: 'all-products', label: 'All Products', visible: true, order: 6 },
      { id: 'uncategorized', label: 'Uncategorized Products', visible: true, order: 7 },
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

// デフォルトセクションを取得するヘルパー関数（useState初期化用）
function getInitialSections(locale: string, pageId: string, customSections?: HomeSection[]): HomeSection[] {
  if (customSections) return customSections;
  const pageDefaults = pageSectionDefaults[pageId];
  if (pageDefaults) {
    return locale === 'ja' ? pageDefaults.ja : pageDefaults.en;
  }
  return locale === 'ja' ? defaultSections : defaultSectionsEn;
}

export function useHomeSections(localeOrOptions: string | UseHomeSectionsOptions = 'ja') {
  // 後方互換性: 文字列の場合はlocaleとして扱う
  const options: UseHomeSectionsOptions = typeof localeOrOptions === 'string'
    ? { locale: localeOrOptions }
    : localeOrOptions;

  const { locale = 'ja', pageId = 'home', customSections } = options;
  const storageKey = `${STORAGE_KEY_PREFIX}_${pageId}`;

  // 初期値としてデフォルトセクションを設定（SSR時にも表示される）
  const [sections, setSections] = useState<HomeSection[]>(() =>
    getInitialSections(locale, pageId, customSections)
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const getDefaultSections = useCallback(() => {
    return getInitialSections(locale, pageId, customSections);
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
