'use client';

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import ProductCard from './ProductCard';
import { Product } from '@/types/product';

interface RelatedProduct {
  id: string;
  title: string;
  normalizedProductId: string | null;
  releaseDate: string | null;
  imageUrl: string | null;
  matchType?: 'performer' | 'tag' | 'recent';
  // Optional additional fields for full ProductCard support
  price?: number;
  provider?: string;
  providerLabel?: string;
  sampleImages?: string[];
  sampleVideos?: Array<{
    url: string;
    type: string;
    quality?: string;
    duration?: number;
  }>;
  duration?: number;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  performers?: Array<{ id: string; name: string }>;
}

interface RelatedProductsProps {
  products: RelatedProduct[];
  title?: string;
}

/**
 * RelatedProduct を Product 型に変換
 */
function convertToProduct(product: RelatedProduct): Product {
  return {
    id: product.id,
    normalizedProductId: product.normalizedProductId || undefined,
    title: product.title,
    description: '',
    price: product.price || 0,
    category: 'all',
    imageUrl: product.imageUrl || '',
    affiliateUrl: '',
    provider: (product.provider as Product['provider']) || 'duga',
    providerLabel: product.providerLabel || '',
    releaseDate: product.releaseDate || undefined,
    sampleImages: product.sampleImages,
    sampleVideos: product.sampleVideos,
    duration: product.duration,
    rating: product.rating,
    reviewCount: product.reviewCount,
    tags: product.tags,
    performers: product.performers,
  };
}

const RelatedProducts = memo(function RelatedProducts({ products, title }: RelatedProductsProps) {
  const params = useParams();
  const _locale = (params?.locale as string) || 'ja';
  const t = useTranslations('relatedProducts');

  const convertedProducts = useMemo(
    () => products.map(convertToProduct),
    [products]
  );

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-white mb-6">{title || t('title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {convertedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
});

export default RelatedProducts;
