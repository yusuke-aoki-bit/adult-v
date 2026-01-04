'use client';

import { SectionNav, HomeSectionManager, type SectionItem } from '@adult-v/shared/components';

interface ProductSectionNavProps {
  locale: string;
  hasSampleVideo: boolean;
  hasPriceComparison: boolean;
  hasCostPerformance: boolean;
  hasAiReview: boolean;
  hasPerformerProducts: boolean;
  hasSeriesProducts: boolean;
  hasMakerProducts: boolean;
  hasAlsoViewed: boolean;
}

export default function ProductSectionNav({
  locale,
  hasSampleVideo,
  hasPriceComparison,
  hasCostPerformance,
  hasAiReview,
  hasPerformerProducts,
  hasSeriesProducts,
  hasMakerProducts,
  hasAlsoViewed,
}: ProductSectionNavProps) {
  const isJa = locale === 'ja';

  const sections: SectionItem[] = [
    { id: 'product-info', label: isJa ? '商品情報' : 'Info' },
  ];

  if (hasSampleVideo) {
    sections.push({ id: 'sample-video', label: isJa ? 'サンプル動画' : 'Video' });
  }

  if (hasPriceComparison) {
    sections.push({ id: 'price-comparison', label: isJa ? '価格比較' : 'Prices' });
  }

  if (hasCostPerformance) {
    sections.push({ id: 'cost-performance', label: isJa ? 'コスパ分析' : 'Value' });
  }

  if (hasAiReview) {
    sections.push({ id: 'ai-review', label: isJa ? 'AIレビュー' : 'AI Review' });
  }

  sections.push({ id: 'scene-timeline', label: isJa ? 'シーン情報' : 'Scenes' });

  if (hasPerformerProducts) {
    sections.push({ id: 'performer-products', label: isJa ? '出演者の他作品' : 'More by Actress' });
  }

  if (hasSeriesProducts) {
    sections.push({ id: 'series-products', label: isJa ? 'シリーズ作品' : 'Series' });
  }

  if (hasMakerProducts) {
    sections.push({ id: 'maker-products', label: isJa ? 'メーカー作品' : 'Maker' });
  }

  // 類似作品ネットワークは常に表示
  sections.push({ id: 'similar-network', label: isJa ? '類似ネットワーク' : 'Similar' });

  if (hasAlsoViewed) {
    sections.push({ id: 'also-viewed', label: isJa ? 'この作品を見た人' : 'Also Viewed' });
  }

  return (
    <>
      <SectionNav sections={sections} theme="light" position="right" offset={80} />
      <HomeSectionManager locale={locale} theme="light" pageId="product" />
    </>
  );
}
