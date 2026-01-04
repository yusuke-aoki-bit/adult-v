'use client';

import { SectionNav, HomeSectionManager, type SectionItem } from '@adult-v/shared/components';

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
  const isJa = locale === 'ja';

  const sections: SectionItem[] = [
    { id: 'profile', label: isJa ? 'プロフィール' : 'Profile' },
  ];

  if (hasCareerAnalysis) {
    sections.push({ id: 'career', label: isJa ? 'キャリア分析' : 'Career' });
  }

  if (hasAiReview) {
    sections.push({ id: 'ai-review', label: isJa ? 'AIレビュー' : 'AI Review' });
  }

  if (hasTopProducts) {
    sections.push({ id: 'top-products', label: isJa ? '人気作品' : 'Top Works' });
  }

  if (hasOnSaleProducts) {
    sections.push({ id: 'on-sale', label: isJa ? 'セール中' : 'On Sale' });
  }

  sections.push({ id: 'filmography', label: isJa ? '全作品' : 'Filmography' });
  sections.push({ id: 'costar-network', label: isJa ? '共演者' : 'Costars' });
  sections.push({ id: 'similar-network', label: isJa ? '類似女優' : 'Similar' });

  return (
    <>
      <SectionNav sections={sections} theme="light" position="right" offset={80} />
      <HomeSectionManager locale={locale} theme="light" pageId="actress" />
    </>
  );
}
