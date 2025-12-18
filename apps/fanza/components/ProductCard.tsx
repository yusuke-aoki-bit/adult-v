'use client';

import { memo } from 'react';
import { ProductCardBase } from '@adult-v/shared/components/ProductCard';
import type { Product } from '@/types/product';
import FavoriteButton from './FavoriteButton';
import ViewedButton from './ViewedButton';
import ImageLightbox from './ImageLightbox';
import StarRating from './StarRating';
import { formatPrice } from '@/lib/utils/subscription';
import { getVariant, trackCtaClick } from '@/lib/ab-testing';

// Initialize theme for light mode (FANZA)
import { setThemeConfig } from '@adult-v/shared/lib/theme';
setThemeConfig({ mode: 'light', primaryColor: 'pink' });

// Light theme placeholder
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/f3f4f6/9ca3af?text=NO+IMAGE';

interface ProductCardProps {
  product: Product;
  /** Ranking position (1-10 shows badge) */
  rankPosition?: number;
  /** Compact mode for grid display */
  compact?: boolean;
}

function ProductCard({ product, rankPosition, compact = false }: ProductCardProps) {
  return (
    <ProductCardBase
      product={product}
      theme="light"
      rankPosition={rankPosition}
      compact={compact}
      placeholderImage={PLACEHOLDER_IMAGE}
      FavoriteButton={FavoriteButton}
      ViewedButton={ViewedButton}
      ImageLightbox={ImageLightbox}
      StarRating={StarRating}
      formatPrice={formatPrice}
      getVariant={getVariant}
      trackCtaClick={trackCtaClick}
      affiliateUrlOptions={{ convertFanzaUrls: true }}
      hideFanzaPurchaseLinks={false}
    />
  );
}

export default memo(ProductCard, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.rankPosition === nextProps.rankPosition &&
    prevProps.compact === nextProps.compact
  );
});
