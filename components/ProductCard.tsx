'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types/product';
import { providerMeta } from '@/lib/mockData';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const provider = providerMeta[product.provider];

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
      <div className="relative h-72">
        <Link href={`/product/${product.id}`}>
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
        <div className="absolute top-4 left-4 flex gap-2">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full text-white bg-gradient-to-r ${provider.accentClass}`}
          >
            {provider.label}
          </span>
          {product.isNew && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/90 text-gray-900">
              NEW
            </span>
          )}
        </div>
        {product.discount && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <Link href={`/product/${product.id}`}>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {product.actressName ?? '出演者情報'} / {product.releaseDate ?? '配信日未定'}
            </p>
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

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-xs text-gray-500">{product.providerLabel}</p>
            <p className="text-2xl font-semibold text-gray-900">
              ¥{product.price.toLocaleString()}
            </p>
          </div>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800"
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
