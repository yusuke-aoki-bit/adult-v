'use client';

import { ForYouRecommendationsSection } from '@adult-v/shared/components';
import { useRecentlyViewed } from '@/hooks';
import ProductCard from './ProductCard';
import ActressCard from './ActressCard';
import type { Product, Actress } from '@/types/product';

// performer情報からActress型に変換
function toActressType(performer: { id: string | number; name: string }): Actress {
  return {
    id: String(performer.id),
    name: performer.name,
    catchcopy: '',
    description: '',
    heroImage: '',
    thumbnail: '',
    primaryGenres: [],
    services: [],
    metrics: {
      releaseCount: 0,
      trendingScore: 0,
      fanScore: 0,
    },
    highlightWorks: [],
    tags: [],
  };
}

// 女優情報をAPIからフェッチ
async function fetchActresses(ids: (string | number)[]): Promise<Actress[]> {
  try {
    const response = await fetch(`/api/actresses?ids=${ids.join(',')}`);
    if (!response.ok) return ids.map(id => toActressType({ id, name: '' }));
    const data = await response.json();
    return data.actresses || [];
  } catch {
    return ids.map(id => toActressType({ id, name: '' }));
  }
}

interface ForYouRecommendationsProps {
  locale?: string;
}

/**
 * あなたへのおすすめセクション
 * 共有コンポーネントを使用
 */
export default function ForYouRecommendations({ locale }: ForYouRecommendationsProps) {
  return (
    <ForYouRecommendationsSection<Product, Actress>
      theme="dark"
      locale={locale}
      ProductCard={ProductCard}
      ActressCard={ActressCard}
      useRecentlyViewed={useRecentlyViewed}
      fetchActresses={fetchActresses}
      toActressType={toActressType}
    />
  );
}
