'use client';

import { ForYouRecommendationsSection } from '@adult-v/shared/components';
import { useRecentlyViewed } from '@/hooks';
import ProductCard from './ProductCard';
import type { Product } from '@/types/product';

/**
 * あなたへのおすすめセクション
 * 共有コンポーネントを使用
 */
export default function ForYouRecommendations() {
  return (
    <ForYouRecommendationsSection<Product>
      theme="light"
      ProductCard={ProductCard}
      useRecentlyViewed={useRecentlyViewed}
    />
  );
}
