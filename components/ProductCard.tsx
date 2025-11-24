'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Product } from '@/types/product';
import { normalizeImageUrl } from '@/lib/image-utils';
import { generateAltText } from '@/lib/seo-utils';
import FavoriteButton from './FavoriteButton';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/1f2937/ffffff?text=NO+IMAGE';

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale();
  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
      <div className="relative h-72 bg-gradient-to-br from-gray-50 to-gray-100">
        <Link href={`/${locale}/products/${product.id}`} className="relative block h-full">
          {/* 画像 */}
          <Image
            src={imgSrc}
            alt={generateAltText(product)}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
            priority={false}
            quality={75}
          />
          {/* No Image オーバーレイ */}
          {(hasError || imgSrc === PLACEHOLDER_IMAGE || !hasValidImageUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-7xl mb-3 text-gray-300">📷</div>
              <span className="inline-block px-4 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-full shadow-md">
                NO IMAGE
              </span>
            </div>
          )}
        </Link>
        {product.isNew && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-600 text-white shadow-lg">
              NEW
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4 bg-white rounded-full shadow-md">
          <FavoriteButton type="product" id={product.id} />
        </div>
        {product.discount && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <Link href={`/${locale}/products/${product.id}`}>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {product.actressName ?? '出演者情報'} / {product.releaseDate ?? '配信日未定'}
            </p>
            <div className="text-xs text-gray-500 mt-1">
              <p>作品ID: {product.normalizedProductId || product.id}</p>
              {product.originalProductId && (
                <p>メーカー品番: {product.originalProductId}</p>
              )}
            </div>
            <h3 className="font-semibold text-xl leading-tight mt-1 line-clamp-2 hover:text-gray-900">
              {product.title}
            </h3>
          </Link>
          <p className="text-sm text-gray-600 mt-2 line-clamp-3">{product.description}</p>
        </div>

        {product.reviewHighlight && (
          <p className="text-sm text-gray-900 bg-gray-100 rounded-xl px-4 py-2 italic">
            “{product.reviewHighlight}”
          </p>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-50 text-gray-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {(product.rating || product.duration) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {product.rating && (
              <>
                <span className="font-semibold text-gray-900">{product.rating.toFixed(1)}</span>
                <span>({product.reviewCount ?? 0}件)</span>
              </>
            )}
            {product.duration && <span>・ {product.duration}分</span>}
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* 価格が0より大きい場合のみ表示 */}
          {product.price > 0 && (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <p className="text-2xl font-semibold text-gray-900">
                ¥{product.price.toLocaleString()}
              </p>
            </div>
          )}
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {product.ctaLabel ?? '配信ページへ'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
