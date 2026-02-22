'use client';

import { memo } from 'react';
import { ActressCardBase, type ActressCardSize } from '@adult-v/shared/components';
import { Actress } from '@/types/product';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';
import FavoriteButton from './FavoriteButton';
import { useSite } from '@/lib/contexts/SiteContext';

interface Props {
  actress: Actress;
  /** @deprecated Use size prop instead */
  compact?: boolean;
  /** Card size: 'full', 'compact', or 'mini' */
  size?: ActressCardSize;
  priority?: boolean;
}

// Fetch product images for lightbox
async function fetchProductImages(actressId: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/products?actressId=${actressId}&limit=30`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.products || [])
      .map((p: { imageUrl?: string | null }) => p.imageUrl)
      .filter((url: string | null | undefined): url is string => !!url)
      .map((url: string) => normalizeImageUrl(url))
      .filter((url: string | null): url is string => !!url);
  } catch {
    return [];
  }
}

function ActressCard({ actress, compact = false, size, priority = false }: Props) {
  const { isFanzaSite, theme } = useSite();

  return (
    <ActressCardBase
      actress={actress}
      compact={compact}
      size={size}
      priority={priority}
      theme={theme}
      FavoriteButton={FavoriteButton}
      isFanzaSite={isFanzaSite}
      fetchProductImages={fetchProductImages}
    />
  );
}

// Memo to prevent re-renders when parent updates but actress data unchanged
export default memo(ActressCard, (prevProps, nextProps) => {
  return (
    prevProps.actress.id === nextProps.actress.id &&
    prevProps.compact === nextProps.compact &&
    prevProps.size === nextProps.size &&
    prevProps.priority === nextProps.priority
  );
});
