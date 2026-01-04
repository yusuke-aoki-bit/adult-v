'use client';

import { SectionNav, type SectionItem } from '../SectionNav';
import { HomeSectionManager } from '../HomeSectionManager';

export interface PageSectionNavConfig {
  // 上部セクション
  hasSale?: boolean;
  hasRecentlyViewed?: boolean;
  // メインセクション
  mainSectionId: string;
  mainSectionLabel: string;
  // 下部セクション
  hasRecommendations?: boolean;
  hasWeeklyHighlights?: boolean;
  hasTrending?: boolean;
  hasAllProducts?: boolean;
}

interface PageSectionNavProps {
  locale: string;
  config: PageSectionNavConfig;
  theme?: 'light' | 'dark';
  position?: 'left' | 'right';
  offset?: number;
  pageId?: string;
}

const translations = {
  ja: {
    sale: 'セール中',
    recentlyViewed: '最近見た作品',
    recommendations: 'おすすめ',
    weeklyHighlights: '今週の注目',
    trending: 'トレンド分析',
    allProducts: '全作品一覧',
  },
  en: {
    sale: 'On Sale',
    recentlyViewed: 'Recently Viewed',
    recommendations: 'For You',
    weeklyHighlights: 'This Week',
    trending: 'Trending',
    allProducts: 'All Products',
  },
  zh: {
    sale: '特卖',
    recentlyViewed: '最近浏览',
    recommendations: '推荐',
    weeklyHighlights: '本周热门',
    trending: '趋势',
    allProducts: '全部作品',
  },
  ko: {
    sale: '세일',
    recentlyViewed: '최근 본 작품',
    recommendations: '추천',
    weeklyHighlights: '이번 주',
    trending: '트렌드',
    allProducts: '전체 작품',
  },
};

export function PageSectionNav({
  locale,
  config,
  theme = 'dark',
  position = 'right',
  offset = 80,
  pageId,
}: PageSectionNavProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const sections: SectionItem[] = [];

  // === 上部セクション ===
  if (config.hasSale) {
    sections.push({ id: 'sale', label: t.sale });
  }

  if (config.hasRecentlyViewed) {
    sections.push({ id: 'recently-viewed', label: t.recentlyViewed });
  }

  // === メインセクション ===
  sections.push({ id: config.mainSectionId, label: config.mainSectionLabel });

  // === 下部セクション ===
  if (config.hasRecommendations) {
    sections.push({ id: 'recommendations', label: t.recommendations });
  }

  if (config.hasWeeklyHighlights) {
    sections.push({ id: 'weekly-highlights', label: t.weeklyHighlights });
  }

  if (config.hasTrending) {
    sections.push({ id: 'trending', label: t.trending });
  }

  if (config.hasAllProducts) {
    sections.push({ id: 'all-products', label: t.allProducts });
  }

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return pageId ? <HomeSectionManager locale={locale} theme={theme} pageId={pageId} /> : null;
  }

  return (
    <>
      <SectionNav sections={sections} theme={theme} position={position} offset={offset} />
      {pageId && <HomeSectionManager locale={locale} theme={theme} pageId={pageId} />}
    </>
  );
}

export default PageSectionNav;
