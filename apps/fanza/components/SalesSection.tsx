'use client';

import { SalesSectionBase } from '@adult-v/shared/components';
import ProductCard from './ProductCard';
import ActressCard from './ActressCard';
import type { Product, Actress } from '@/types/product';

interface SaleProductMeta {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

interface SalesSectionProps {
  saleProducts: SaleProductMeta[];
  locale?: string;
  defaultOpen?: boolean;
}

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

/**
 * セール中商品セクション
 * 共有コンポーネントを使用
 */
export default function SalesSection({ saleProducts, locale, defaultOpen }: SalesSectionProps) {
  return (
    <SalesSectionBase<Product, Actress>
      theme="light"
      locale={locale}
      ProductCard={ProductCard}
      ActressCard={ActressCard}
      saleProducts={saleProducts}
      fetchActresses={fetchActresses}
      toActressType={toActressType}
      defaultOpen={defaultOpen}
    />
  );
}
