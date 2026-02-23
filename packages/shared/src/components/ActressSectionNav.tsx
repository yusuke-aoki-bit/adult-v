'use client';

import { SectionNav, type SectionItem } from './SectionNav';
import HomeSectionManager from './HomeSectionManager';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, actressSectionNavTranslations } from '../lib/translations';

interface ActressSectionNavProps {
  locale: string;
  hasAiReview: boolean;
  hasCareerAnalysis: boolean;
  hasTopProducts: boolean;
  hasOnSaleProducts: boolean;
}

export default function ActressSectionNav({
  locale,
  hasAiReview,
  hasCareerAnalysis,
  hasTopProducts,
  hasOnSaleProducts,
}: ActressSectionNavProps) {
  const { theme } = useSiteTheme();
  const nt = getTranslation(actressSectionNavTranslations, locale);

  const sections: SectionItem[] = [{ id: 'profile', label: nt.profile }];

  if (hasCareerAnalysis) {
    sections.push({ id: 'career', label: nt.career });
  }

  if (hasAiReview) {
    sections.push({ id: 'ai-review', label: nt.aiReview });
  }

  if (hasTopProducts) {
    sections.push({ id: 'top-products', label: nt.topProducts });
  }

  if (hasOnSaleProducts) {
    sections.push({ id: 'on-sale', label: nt.onSale });
  }

  sections.push({ id: 'filmography', label: nt.filmography });
  sections.push({ id: 'costar-network', label: nt.costars });
  sections.push({ id: 'similar-network', label: nt.similar });

  return (
    <>
      <SectionNav sections={sections} theme={theme} position="right" offset={80} />
      <HomeSectionManager locale={locale} theme={theme} pageId="actress" />
    </>
  );
}
