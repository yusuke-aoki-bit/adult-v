'use client';

import { SectionNav, type SectionItem } from './SectionNav';
import HomeSectionManager from './HomeSectionManager';
import { useSiteTheme } from '../contexts/SiteThemeContext';

const navTexts = {
  ja: { profile: 'プロフィール', career: 'キャリア分析', aiReview: 'AIレビュー', topProducts: '人気作品', onSale: 'セール中', filmography: '全作品', costars: '共演者', similar: '類似女優' },
  en: { profile: 'Profile', career: 'Career', aiReview: 'AI Review', topProducts: 'Top Works', onSale: 'On Sale', filmography: 'Filmography', costars: 'Costars', similar: 'Similar' },
} as const;
function getNavText(locale: string) { return navTexts[locale as keyof typeof navTexts] || navTexts.ja; }

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
  const nt = getNavText(locale);

  const sections: SectionItem[] = [
    { id: 'profile', label: nt.profile },
  ];

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
