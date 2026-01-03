'use client';

import { SectionNav, type SectionItem } from '@adult-v/shared/components';

interface TopPageSectionNavProps {
  locale: string;
  hasSaleProducts: boolean;
  hasRecentlyViewed: boolean;
  hasRecommendations: boolean;
}

export default function TopPageSectionNav({
  locale,
  hasSaleProducts,
  hasRecentlyViewed,
  hasRecommendations,
}: TopPageSectionNavProps) {
  const isJa = locale === 'ja';

  const sections: SectionItem[] = [];

  if (hasSaleProducts) {
    sections.push({ id: 'sale', label: isJa ? 'セール中' : 'On Sale' });
  }

  if (hasRecentlyViewed) {
    sections.push({ id: 'recently-viewed', label: isJa ? '最近見た作品' : 'Recently Viewed' });
  }

  sections.push({ id: 'list', label: isJa ? '女優一覧' : 'Actresses' });

  if (hasRecommendations) {
    sections.push({ id: 'recommendations', label: isJa ? 'おすすめ' : 'For You' });
  }

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return null;
  }

  return <SectionNav sections={sections} theme="light" position="right" offset={80} />;
}
