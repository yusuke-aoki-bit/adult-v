'use client';

import { SectionNav, type SectionItem } from '@adult-v/shared/components';

interface TopPageSectionNavProps {
  locale: string;
  hasSaleProducts: boolean;
  hasRecentlyViewed: boolean;
  hasRecommendations: boolean;
}

const translations = {
  ja: {
    // 上部セクション
    sale: 'セール中',
    recentlyViewed: '最近見た作品',
    // 女優一覧
    actresses: '女優一覧',
    // 下部セクション
    recommendations: 'おすすめ',
    weeklyHighlights: '今週の注目',
    trending: 'トレンド分析',
    allProducts: '全作品一覧',
    uncategorized: '未整理作品',
  },
  en: {
    sale: 'On Sale',
    recentlyViewed: 'Recently Viewed',
    actresses: 'Actresses',
    recommendations: 'For You',
    weeklyHighlights: 'This Week',
    trending: 'Trending',
    allProducts: 'All Products',
    uncategorized: 'Uncategorized',
  },
  zh: {
    sale: '特卖',
    recentlyViewed: '最近浏览',
    actresses: '女优',
    recommendations: '推荐',
    weeklyHighlights: '本周热门',
    trending: '趋势',
    allProducts: '全部作品',
    uncategorized: '未分类',
  },
  ko: {
    sale: '세일',
    recentlyViewed: '최근 본 작품',
    actresses: '배우',
    recommendations: '추천',
    weeklyHighlights: '이번 주',
    trending: '트렌드',
    allProducts: '전체 작품',
    uncategorized: '미분류',
  },
};

export default function TopPageSectionNav({
  locale,
  hasSaleProducts,
  hasRecentlyViewed,
  hasRecommendations,
}: TopPageSectionNavProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const sections: SectionItem[] = [];

  // === 上部セクション ===
  if (hasSaleProducts) {
    sections.push({ id: 'sale', label: t.sale });
  }

  if (hasRecentlyViewed) {
    sections.push({ id: 'recently-viewed', label: t.recentlyViewed });
  }

  // === 女優一覧（メインコンテンツ） ===
  sections.push({ id: 'list', label: t.actresses });

  // === 下部セクション ===
  if (hasRecommendations) {
    sections.push({ id: 'recommendations', label: t.recommendations });
  }

  sections.push({ id: 'weekly-highlights', label: t.weeklyHighlights });
  sections.push({ id: 'trending', label: t.trending });
  sections.push({ id: 'all-products', label: t.allProducts });

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return null;
  }

  return <SectionNav sections={sections} theme="light" position="right" offset={80} />;
}
