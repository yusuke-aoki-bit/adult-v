'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { normalizeImageUrl, isDtiUncensoredSite } from '@/lib/image-utils';

interface RelatedProduct {
  id: string;
  title: string;
  normalizedProductId: string | null;
  releaseDate: string | null;
  imageUrl: string | null;
  matchType?: 'performer' | 'tag' | 'recent';
}

interface RelatedProductsProps {
  products: RelatedProduct[];
  title?: string;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x420/1f2937/ffffff?text=NO+IMAGE';

export default function RelatedProducts({ products, title }: RelatedProductsProps) {
  const locale = useLocale();
  const t = useTranslations('relatedProducts');

  if (products.length === 0) {
    return null;
  }

  const getMatchTypeLabel = (matchType?: string) => {
    switch (matchType) {
      case 'performer':
        return t('samePerformer');
      case 'tag':
        return t('sameGenre');
      case 'recent':
        return t('recent');
      default:
        return '';
    }
  };

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{title || t('title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/${locale}/products/${product.id}`}
            className="group bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:ring-2 hover:ring-rose-700 transition-all"
          >
            <div className="relative aspect-[3/4] bg-gray-100">
              <Image
                src={product.imageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE}
                alt={product.title}
                fill
                className={`object-cover ${isDtiUncensoredSite(product.imageUrl || '') ? 'blur-[3px]' : ''}`}
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                loading="lazy"
              />
              {product.matchType && (
                <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-700 shadow-sm">
                  {getMatchTypeLabel(product.matchType)}
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-800 line-clamp-2 group-hover:text-rose-700 transition-colors">
                {product.title}
              </p>
              {product.releaseDate && (
                <p className="text-xs text-gray-500 mt-1">{product.releaseDate}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
