'use client';

import { SectionNav, type SectionItem } from './SectionNav';
import HomeSectionManager from './HomeSectionManager';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, productSectionNavTranslations } from '../lib/translations';

interface ProductSectionNavProps {
  locale: string;
  hasSampleVideo: boolean;
  hasPriceComparison: boolean;
  hasAnalysis: boolean;
  hasRelatedProducts: boolean;
  hasAlsoViewed: boolean;
}

export default function ProductSectionNav({
  locale,
  hasSampleVideo,
  hasPriceComparison,
  hasAnalysis,
  hasRelatedProducts,
  hasAlsoViewed,
}: ProductSectionNavProps) {
  const { theme } = useSiteTheme();
  const nt = getTranslation(productSectionNavTranslations, locale);

  const sections: SectionItem[] = [{ id: 'product-info', label: nt.info }];

  if (hasSampleVideo) {
    sections.push({ id: 'sample-video', label: nt.video });
  }

  if (hasPriceComparison) {
    sections.push({ id: 'price-comparison', label: nt.prices });
  }

  if (hasAnalysis) {
    sections.push({ id: 'analysis', label: nt.aiReview });
  }

  if (hasRelatedProducts) {
    sections.push({ id: 'related-products', label: nt.performer });
  }

  if (hasAlsoViewed) {
    sections.push({ id: 'also-viewed', label: nt.alsoViewed });
  }

  return (
    <>
      <SectionNav sections={sections} theme={theme} position="right" offset={80} />
      <HomeSectionManager locale={locale} theme={theme} pageId="product" />
    </>
  );
}
