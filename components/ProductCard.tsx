'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Product } from '@/types/product';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '@/lib/image-utils';
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
  const [showModal, setShowModal] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  // DTI系（無修正）サイトの画像かどうか
  const isUncensored = isDtiUncensoredSite(imgSrc);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // プレースホルダー画像の場合はモーダルを開かない（無修正はブラー付きで拡大OK）
    if (imgSrc !== PLACEHOLDER_IMAGE && hasValidImageUrl && !hasError) {
      setShowModal(true);
    }
  }, [imgSrc, hasValidImageUrl, hasError]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
      <div className="relative h-72 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="relative block h-full group">
          {/* 画像クリックでフルサイズ表示 */}
          <button
            type="button"
            onClick={handleImageClick}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none"
            aria-label="画像を拡大表示"
          />
          <Image
            src={imgSrc}
            alt={generateAltText(product)}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
            priority={false}
            quality={75}
          />
          {/* ズームアイコン */}
          {hasValidImageUrl && !hasError && imgSrc !== PLACEHOLDER_IMAGE && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
          {/* No Image オーバーレイ */}
          {(hasError || imgSrc === PLACEHOLDER_IMAGE || !hasValidImageUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-7xl mb-3 text-gray-300">📷</div>
              <span className="inline-block px-4 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-full shadow-md">
                NO IMAGE
              </span>
            </div>
          )}
        </div>
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
          {/* 価格表示: 価格がある場合は価格を表示、月額制で価格0の場合は「月額会員限定」と表示 */}
          {product.price > 0 ? (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <p className="text-2xl font-semibold text-gray-900">
                ¥{product.price.toLocaleString()}
              </p>
            </div>
          ) : isSubscriptionSite(product.provider) ? (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <p className="text-lg font-semibold text-rose-600">
                月額会員限定
              </p>
            </div>
          ) : null}
          <Link
            href={`/${locale}/products/${product.id}`}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800"
          >
            {product.ctaLabel ?? '詳細を見る'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* フルサイズ画像モーダル */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={handleCloseModal}
        >
          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            aria-label="閉じる"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* フルサイズ画像 */}
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFullSizeImageUrl(imgSrc)}
              alt={generateAltText(product)}
              className={`max-w-full max-h-[90vh] object-contain rounded-lg ${isUncensored ? 'blur-[3px]' : ''}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
