'use client';

import { RecentlyViewedSection } from '@adult-v/shared/components';
import { useRecentlyViewed } from '@/hooks';
import ProductCard from './ProductCard';
import type { Product } from '@/types/product';

/**
 * 最近見た作品セクション
 * 共有コンポーネントを使用
 */
export default function RecentlyViewed() {
  return (
    <RecentlyViewedSection<Product>
      theme="light"
      ProductCard={ProductCard}
      useRecentlyViewed={useRecentlyViewed}
    />
  );
}
