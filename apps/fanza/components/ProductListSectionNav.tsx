'use client';

import { SectionNav, type SectionItem } from '@adult-v/shared/components';

interface ProductListSectionNavProps {
  locale: string;
  hasSaleProducts: boolean;
}

export default function ProductListSectionNav({
  locale,
  hasSaleProducts,
}: ProductListSectionNavProps) {
  const isJa = locale === 'ja';

  const sections: SectionItem[] = [];

  if (hasSaleProducts) {
    sections.push({ id: 'sale', label: isJa ? 'セール中' : 'On Sale' });
  }

  sections.push({ id: 'products', label: isJa ? '商品一覧' : 'Products' });

  // 1セクションのみの場合はナビゲーションを表示しない
  if (sections.length <= 1) {
    return null;
  }

  return <SectionNav sections={sections} theme="light" position="right" offset={80} />;
}
