'use client';

import { ProductListWithSelection } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';
import ProductCard from './ProductCard';

interface Product {
  id: number | string;
  title: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

interface ProductGridWithComparisonProps {
  products: Product[];
  locale: string;
  priority?: number;
  className?: string;
}

export function ProductGridWithComparison({
  products,
  locale,
  priority = 6,
  className,
}: ProductGridWithComparisonProps) {
  const theme = useSiteTheme();

  return (
    <ProductListWithSelection products={products} locale={locale} theme={theme} className={className}>
      {(product, index) => (
        <ProductCard
          key={product.id}
          product={product as Parameters<typeof ProductCard>[0]['product']}
          priority={index < priority}
        />
      )}
    </ProductListWithSelection>
  );
}

export default ProductGridWithComparison;
