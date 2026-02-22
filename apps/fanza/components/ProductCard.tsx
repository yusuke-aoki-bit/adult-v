'use client';

import { memo } from 'react';
import { ProductCardBase, type ProductCardSize } from '@adult-v/shared/components/ProductCard';
import type { Product } from '@/types/product';
import FavoriteButton from './FavoriteButton';
import ViewedButton from './ViewedButton';
import ImageLightbox from './ImageLightbox';
import StarRating from './StarRating';
import { formatPrice } from '@adult-v/shared/providers';
import { getVariant, trackCtaClick } from '@/lib/ab-testing';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

// Initialize theme for light mode (FANZA)
import { setThemeConfig } from '@adult-v/shared/lib/theme';
setThemeConfig({ mode: 'light', primaryColor: 'pink' });

// Light theme placeholder
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/f3f4f6/9ca3af?text=NO+IMAGE';

interface ProductCardProps {
  product: Product;
  /** Ranking position (1-10 shows badge) */
  rankPosition?: number;
  /** @deprecated Use size prop instead */
  compact?: boolean;
  /** Card size: 'full', 'compact', or 'mini' */
  size?: ProductCardSize;
  /** Priority loading for LCP optimization (first few cards) */
  priority?: boolean;
}

function ProductCard({ product, rankPosition, compact = false, size, priority = false }: ProductCardProps) {
  const theme = useSiteTheme();
  return (
    <ProductCardBase
      product={product}
      theme={theme}
      rankPosition={rankPosition}
      compact={compact}
      size={size}
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
      priority={priority}
    />
  );
}

export default memo(ProductCard, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.rankPosition === nextProps.rankPosition &&
    prevProps.compact === nextProps.compact &&
    prevProps.size === nextProps.size &&
    prevProps.priority === nextProps.priority
  );
});
