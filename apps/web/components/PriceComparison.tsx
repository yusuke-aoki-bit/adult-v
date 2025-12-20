'use client';

import { PriceComparison as BasePriceComparison } from '@adult-v/shared/components';

interface PriceComparisonProps {
  productId: string;
}

/**
 * PriceComparison wrapper for apps/web (dark theme)
 */
export default function PriceComparison({ productId }: PriceComparisonProps) {
  return <BasePriceComparison productId={productId} theme="dark" />;
}
