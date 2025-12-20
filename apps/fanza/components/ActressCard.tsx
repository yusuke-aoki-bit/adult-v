'use client';

import { ActressCardBase, type ActressCardSize } from '@adult-v/shared/components';
import { Actress } from '@/types/product';
import { normalizeImageUrl } from '@/lib/image-utils';
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

export default function ActressCard({ actress, compact = false, size, priority = false }: Props) {
  const { isFanzaSite } = useSite();

  return (
    <ActressCardBase
      actress={actress}
      compact={compact}
      size={size}
      priority={priority}
      theme="light"
      FavoriteButton={FavoriteButton}
      isFanzaSite={isFanzaSite}
      fetchProductImages={fetchProductImages}
    />
  );
}
