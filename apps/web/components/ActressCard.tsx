'use client';

import { memo } from 'react';
import { ActressCardBase } from '@adult-v/shared/components';
import { Actress } from '@/types/product';
import { normalizeImageUrl } from '@/lib/image-utils';
import FavoriteButton from './FavoriteButton';

interface Props {
  actress: Actress;
  compact?: boolean;
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

function ActressCard({ actress, compact = false, priority = false }: Props) {
  return (
    <ActressCardBase
      actress={actress}
      compact={compact}
      priority={priority}
      theme="dark"
      FavoriteButton={FavoriteButton}
      isFanzaSite={false}
      fetchProductImages={fetchProductImages}
    />
  );
}

// Memo to prevent re-renders when parent updates but actress data unchanged
export default memo(ActressCard, (prevProps, nextProps) => {
  return (
    prevProps.actress.id === nextProps.actress.id &&
    prevProps.compact === nextProps.compact &&
    prevProps.priority === nextProps.priority
  );
});
