'use client';

import { PriceComparison as BasePriceComparison } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

interface PriceComparisonProps {
  productId: string;
}

/**
 * PriceComparison wrapper - テーマはSiteContextから自動取得
 */
export default function PriceComparison({ productId }: PriceComparisonProps) {
  const theme = useSiteTheme();
  return <BasePriceComparison productId={productId} theme={theme} />;
}
