'use client';

import { SalesSectionBase } from '@adult-v/shared/components';
import ProductCard from './ProductCard';
import type { Product } from '@/types/product';

interface SaleProductMeta {
  productId: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string;
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
}

/**
 * セール中商品セクション
 * 共有コンポーネントを使用
 */
export default function SalesSection({ saleProducts }: SalesSectionProps) {
  return (
    <SalesSectionBase<Product>
      theme="dark"
      ProductCard={ProductCard}
      saleProducts={saleProducts}
    />
  );
}
