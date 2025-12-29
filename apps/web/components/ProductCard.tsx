'use client';

import { memo } from 'react';
import { ProductCardBase, type ProductCardSize } from '@adult-v/shared/components/ProductCard';
import type { Product } from '@/types/product';
import { PLACEHOLDERS } from '@adult-v/shared/constants/app';
import FavoriteButton from './FavoriteButton';
import ViewedButton from './ViewedButton';
import ImageLightbox from './ImageLightbox';
import StarRating from './StarRating';
import { formatPrice } from '@/lib/utils/subscription';
import { getVariant, trackCtaClick } from '@/lib/ab-testing';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

// Initialize theme for dark mode (Adult Viewer Lab)
import { setThemeConfig } from '@adult-v/shared/lib/theme';
setThemeConfig({ mode: 'dark', primaryColor: 'rose' });

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
      placeholderImage={PLACEHOLDERS.PRODUCT}
      FavoriteButton={FavoriteButton}
      ViewedButton={ViewedButton}
      ImageLightbox={ImageLightbox}
      StarRating={StarRating}
      formatPrice={formatPrice}
      getVariant={getVariant}
      trackCtaClick={trackCtaClick}
      hideFanzaPurchaseLinks={true}
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
