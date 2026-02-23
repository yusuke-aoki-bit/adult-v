'use client';

import { SectionNav, type SectionItem } from '../SectionNav';
import { HomeSectionManager } from '../HomeSectionManager';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, pageSectionNavTranslations } from '../../lib/translations';

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

export function PageSectionNav({
  locale,
  config,
  theme: themeProp,
  position = 'right',
  offset = 80,
  pageId,
}: PageSectionNavProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const t = getTranslation(pageSectionNavTranslations, locale);

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
