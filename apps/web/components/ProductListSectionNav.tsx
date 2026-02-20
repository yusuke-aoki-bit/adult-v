'use client';

import { SectionNav, type SectionItem } from '@adult-v/shared/components';

const navTexts = {
  ja: { onSale: 'セール中', products: '商品一覧' },
  en: { onSale: 'On Sale', products: 'Products' },
} as const;
function getNavText(locale: string) { return navTexts[locale as keyof typeof navTexts] || navTexts.ja; }

interface ProductListSectionNavProps {
  locale: string;
  hasSaleProducts: boolean;
}

export default function ProductListSectionNav({
  locale,
  hasSaleProducts,
}: ProductListSectionNavProps) {
  const nt = getNavText(locale);

  const sections: SectionItem[] = [];

  if (hasSaleProducts) {
    sections.push({ id: 'sale', label: nt.onSale });
  }

  sections.push({ id: 'products', label: nt.products });

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return null;
  }

  return <SectionNav sections={sections} theme="dark" position="right" offset={80} />;
}
