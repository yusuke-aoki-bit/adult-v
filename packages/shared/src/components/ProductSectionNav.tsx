'use client';

import { SectionNav, type SectionItem } from './SectionNav';
import HomeSectionManager from './HomeSectionManager';
import { useSiteTheme } from '../contexts/SiteThemeContext';

const navTexts = {
  ja: { info: '商品情報', video: 'サンプル動画', prices: '価格比較', value: 'コスパ分析', aiReview: 'AIレビュー', scenes: 'シーン情報', performer: '出演者の他作品', series: 'シリーズ作品', maker: 'メーカー作品', similar: '類似ネットワーク', alsoViewed: 'この作品を見た人' },
  en: { info: 'Info', video: 'Video', prices: 'Prices', value: 'Value', aiReview: 'AI Review', scenes: 'Scenes', performer: 'More by Actress', series: 'Series', maker: 'Maker', similar: 'Similar', alsoViewed: 'Also Viewed' },
} as const;
function getNavText(locale: string) { return navTexts[locale as keyof typeof navTexts] || navTexts.ja; }

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
  const { theme } = useSiteTheme();
  const nt = getNavText(locale);

  const sections: SectionItem[] = [
    { id: 'product-info', label: nt.info },
  ];

  if (hasSampleVideo) {
    sections.push({ id: 'sample-video', label: nt.video });
  }

  if (hasPriceComparison) {
    sections.push({ id: 'price-comparison', label: nt.prices });
  }

  if (hasCostPerformance) {
    sections.push({ id: 'cost-performance', label: nt.value });
  }

  if (hasAiReview) {
    sections.push({ id: 'ai-review', label: nt.aiReview });
  }

  sections.push({ id: 'scene-timeline', label: nt.scenes });

  if (hasPerformerProducts) {
    sections.push({ id: 'performer-products', label: nt.performer });
  }

  if (hasSeriesProducts) {
    sections.push({ id: 'series-products', label: nt.series });
  }

  if (hasMakerProducts) {
    sections.push({ id: 'maker-products', label: nt.maker });
  }

  sections.push({ id: 'similar-network', label: nt.similar });

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
