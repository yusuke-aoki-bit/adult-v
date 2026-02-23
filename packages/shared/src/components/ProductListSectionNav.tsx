'use client';

import { SectionNav, type SectionItem } from './SectionNav';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, productListSectionNavTranslations } from '../lib/translations';

interface ProductListSectionNavProps {
  locale: string;
  hasSaleProducts: boolean;
}

export default function ProductListSectionNav({ locale, hasSaleProducts }: ProductListSectionNavProps) {
  const { theme } = useSiteTheme();
  const nt = getTranslation(productListSectionNavTranslations, locale);

  const sections: SectionItem[] = [];

  if (hasSaleProducts) {
    sections.push({ id: 'sale', label: nt.onSale });
  }

  sections.push({ id: 'products', label: nt.products });

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return null;
  }

  return <SectionNav sections={sections} theme={theme} position="right" offset={80} />;
}
