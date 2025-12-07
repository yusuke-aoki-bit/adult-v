'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Product } from '@/types/product';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '@/lib/image-utils';
import { generateAltText } from '@/lib/seo-utils';
import { formatPrice } from '@/lib/utils/subscription';
import FavoriteButton from './FavoriteButton';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/1f2937/ffffff?text=NO+IMAGE';

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations('productCard');
  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImgError, setModalImgError] = useState(false);

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
    setModalImgError(false); // モーダルを閉じるときにエラー状態をリセット
  }, []);

  // ESCキーでモーダルを閉じる & スクロール無効化
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
      <div className="relative h-72 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="relative block h-full group">
          {/* 画像クリックでフルサイズ表示 */}
          <button
            type="button"
            onClick={handleImageClick}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none"
            aria-label={t('enlargeImage')}
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
        {product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white shadow-lg">
              {t('comingSoon')}
            </span>
          </div>
        )}
        {product.isNew && !product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-600 text-white shadow-lg">
              NEW
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4 bg-white rounded-full shadow-md">
          <FavoriteButton type="product" id={product.id} />
        </div>
        {product.discount && !product.salePrice && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <Link href={`/${locale}/products/${product.id}`}>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {product.actressName ?? t('performerInfo')} / {product.releaseDate ?? t('releaseDateTbd')}
            </p>
            <div className="text-xs text-gray-500 mt-1">
              <p>{t('productId')}: {product.normalizedProductId || product.id}</p>
              {product.originalProductId && (
                <p>{t('manufacturerId')}: {product.originalProductId}</p>
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
                <span>({product.reviewCount ?? 0}{t('reviews')})</span>
              </>
            )}
            {product.duration && <span>・ {product.duration}{t('minutes')}</span>}
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* 価格表示: セール中の場合は通常価格を取り消し線、セール価格を強調表示 */}
          {product.salePrice && product.regularPrice ? (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-red-600">
                  {formatPrice(product.salePrice, product.currency)}
                </p>
                <p className="text-sm text-gray-400 line-through">
                  {formatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                    {product.discount}%OFF
                  </span>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>
          ) : isSubscriptionSite(product.provider) ? (
            <div>
              <p className="text-xs text-gray-500">{product.providerLabel}</p>
              <p className="text-lg font-semibold text-rose-600">
                {t('subscriptionOnly')}
              </p>
            </div>
          ) : null}
          <Link
            href={`/${locale}/products/${product.id}`}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800"
          >
            {product.ctaLabel ?? t('viewDetails')}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 cursor-pointer"
          onClick={handleCloseModal}
        >
          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            aria-label={t('close')}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* クリックで閉じるヒント */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded text-white/70 text-sm pointer-events-none">
            {t('clickToCloseEsc')}
          </div>
          {/* フルサイズ画像 - 画像クリックでも閉じる */}
          <div className="relative max-w-[90vw] max-h-[85vh] pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modalImgError ? imgSrc : getFullSizeImageUrl(imgSrc)}
              alt={generateAltText(product)}
              className={`max-w-full max-h-[85vh] object-contain rounded-lg ${isUncensored ? 'blur-[3px]' : ''}`}
              onError={() => {
                if (!modalImgError) {
                  setModalImgError(true);
                }
              }}
            />
          </div>
          {/* 詳細ページへのリンク */}
          <Link
            href={`/${locale}/products/${product.id}`}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition-colors pointer-events-auto flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {t('viewDetails')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
