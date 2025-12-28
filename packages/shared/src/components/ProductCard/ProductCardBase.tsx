'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo, memo, type ReactNode, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams, useParams } from 'next/navigation';
import type { Product } from '../../types';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '../../lib/image-utils';
import { generateAltText } from '../../lib/seo-utils';
import { getThemeConfig, type ProductCardTheme } from './themes';
import { getAffiliateUrl, type GetAffiliateUrlOptions } from './helpers';

// Blur placeholder for images
const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

export type ProductCardSize = 'full' | 'compact' | 'mini';

export interface ProductCardBaseProps {
  product: Product;
  /** Theme: 'dark' for adult-v, 'light' for fanza */
  theme: ProductCardTheme;
  /** Ranking position (1-10 shows badge) */
  rankPosition?: number;
  /** @deprecated Use size prop instead */
  compact?: boolean;
  /** Card size: 'full', 'compact', or 'mini' */
  size?: ProductCardSize;
  /** Placeholder image URL */
  placeholderImage?: string;
  /** FavoriteButton component from app */
  FavoriteButton?: ComponentType<{ type: 'product'; id: string | number; size?: 'xs' | 'sm' | 'md' | 'lg' }>;
  /** ViewedButton component from app */
  ViewedButton?: ComponentType<{
    productId: string;
    title: string;
    imageUrl: string | null;
    aspName: string;
    performerName?: string;
    performerId?: string | number;
    tags?: string[];
    duration?: number;
    size?: 'xs' | 'sm' | 'md';
    iconOnly?: boolean;
    className?: string;
  }>;
  /** ImageLightbox component from app */
  ImageLightbox?: ComponentType<{
    images: string[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
    alt: string;
    detailsUrl?: string;
  }>;
  /** StarRating component from app */
  StarRating?: ComponentType<{
    rating: number;
    reviewCount?: number;
    size?: 'sm' | 'md' | 'lg';
    showCount?: boolean;
  }>;
  /** Format price function */
  formatPrice?: (price: number, currency?: string) => string;
  /** Get A/B test variant */
  getVariant?: (testName: string) => string;
  /** Track CTA click */
  trackCtaClick?: (testName: string, productId: string | number, params?: Record<string, string | number | boolean>) => void;
  /** Affiliate URL options */
  affiliateUrlOptions?: GetAffiliateUrlOptions;
  /** Whether to hide FANZA purchase links (for adult-v site) */
  hideFanzaPurchaseLinks?: boolean;
}

// Default placeholder images
const DEFAULT_PLACEHOLDER_DARK = 'https://placehold.co/400x560/374151/6b7280?text=NO+IMAGE';
const DEFAULT_PLACEHOLDER_LIGHT = 'https://placehold.co/400x560/f3f4f6/9ca3af?text=NO+IMAGE';

function ProductCardBase({
  product,
  theme,
  rankPosition,
  compact = false,
  size,
  placeholderImage,
  FavoriteButton,
  ViewedButton,
  ImageLightbox,
  StarRating,
  formatPrice,
  getVariant,
  trackCtaClick,
  affiliateUrlOptions = {},
  hideFanzaPurchaseLinks = false,
}: ProductCardBaseProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = useTranslations('productCard');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const themeConfig = getThemeConfig(theme);

  // Resolve size from either new size prop or deprecated compact prop
  const resolvedSize: ProductCardSize = size ?? (compact ? 'compact' : 'full');

  // Use default placeholder based on theme if not provided
  const resolvedPlaceholder = placeholderImage ?? (theme === 'dark' ? DEFAULT_PLACEHOLDER_DARK : DEFAULT_PLACEHOLDER_LIGHT);

  // Default formatPrice if not provided - memoize fallback
  const resolvedFormatPrice = useMemo(() =>
    formatPrice ?? ((price: number, currency?: string) =>
      currency === 'USD' ? `$${price.toLocaleString()}` : `¥${price.toLocaleString()}`
    ),
    [formatPrice]
  );

  // Default getVariant if not provided - memoize fallback
  const resolvedGetVariant = useMemo(() =>
    getVariant ?? (() => 'default'),
    [getVariant]
  );

  // Default trackCtaClick if not provided - memoize fallback
  const resolvedTrackCtaClick = useMemo(() =>
    trackCtaClick ?? (() => {}),
    [trackCtaClick]
  );

  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : resolvedPlaceholder);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const hasSampleVideo = product.sampleVideos && product.sampleVideos.length > 0;
  const primaryVideo = hasSampleVideo ? product.sampleVideos![0] : null;

  const allImages = useMemo(() => {
    const images: string[] = [];
    if (hasValidImageUrl && product.imageUrl) {
      const normalized = normalizeImageUrl(product.imageUrl);
      const fullSize = getFullSizeImageUrl(normalized);
      images.push(fullSize);
    }
    if (product.sampleImages && product.sampleImages.length > 0) {
      product.sampleImages.forEach(img => {
        const normalized = normalizeImageUrl(img);
        const fullSize = getFullSizeImageUrl(normalized);
        if (!images.includes(fullSize)) {
          images.push(fullSize);
        }
      });
    }
    return images;
  }, [product.imageUrl, product.sampleImages, hasValidImageUrl]);

  const isActressPage = pathname.includes('/actress/');

  const getTagFilterUrl = useCallback((tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const existingInclude = params.get('include');
    if (existingInclude) {
      const existingTags = existingInclude.split(',').map(t => t.trim());
      if (!existingTags.includes(tag)) {
        params.set('include', [...existingTags, tag].join(','));
      }
    } else {
      params.set('include', tag);
    }
    params.delete('page');
    if (isActressPage) {
      return `${pathname}?${params.toString()}`;
    }
    return `/${locale}/products?${params.toString()}`;
  }, [isActressPage, pathname, searchParams, locale]);

  const handleImageError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(resolvedPlaceholder);
    }
  }, [hasError, resolvedPlaceholder]);

  const isUncensored = isDtiUncensoredSite(imgSrc);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imgSrc !== resolvedPlaceholder && hasValidImageUrl && !hasError) {
      setShowModal(true);
    }
  }, [imgSrc, hasValidImageUrl, hasError, resolvedPlaceholder]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalImageIndex(0);
  }, []);

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasSampleVideo) {
      setShowVideoModal(true);
    }
  }, [hasSampleVideo]);

  const handleCloseVideoModal = useCallback(() => {
    setShowVideoModal(false);
  }, []);

  // CTA click handler - memoized to avoid recreation on each render
  const handleCtaClick = useCallback(() => {
    resolvedTrackCtaClick('ctaButtonText', product.id, {
      is_sale: !!product.salePrice,
      provider: product.provider || '',
    });
  }, [resolvedTrackCtaClick, product.id, product.salePrice, product.provider]);

  // Mini size - simplest card for WeeklyHighlights, etc.
  if (resolvedSize === 'mini') {
    const miniAffiliateUrl = getAffiliateUrl(product.affiliateUrl, affiliateUrlOptions);
    const showMiniCta = miniAffiliateUrl && !(hideFanzaPurchaseLinks && product.provider === 'fanza');

    return (
      <div className={`group relative ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500/50 transition-all`}>
        <Link href={`/${locale}/products/${product.id}`}>
          <div className={`relative ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`} style={{ aspectRatio: '2/3' }}>
            {hasValidImageUrl ? (
              <Image
                src={imgSrc}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 33vw, 10vw"
                className={`object-cover group-hover:scale-105 transition-transform duration-300 ${isUncensored ? 'blur-[1px]' : ''}`}
                loading="lazy"
                onError={handleImageError}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <svg className={`h-8 w-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
            )}
            {product.rating && product.rating > 0 && (
              <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {product.rating.toFixed(1)}
              </div>
            )}
            {/* ホバー時CTA オーバーレイ */}
            {showMiniCta && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <span className={`text-white text-[10px] font-bold px-2 py-1 rounded ${
                  product.salePrice ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'
                }`}>
                  {product.salePrice ? t('viewSale') : t('viewDetails')}
                </span>
              </div>
            )}
          </div>
          <div className="p-1.5">
            <p className={`${theme === 'dark' ? 'text-gray-200 group-hover:text-orange-300' : 'text-gray-800 group-hover:text-orange-600'} text-xs font-medium line-clamp-2 transition-colors`}>
              {product.title}
            </p>
          </div>
        </Link>
        {/* 外部リンクCTA（ホバー時のみ表示） */}
        {showMiniCta && (
          <a
            href={miniAffiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-0 left-0 right-0 py-1.5 text-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              product.salePrice ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'
            }`}
          >
            {product.providerLabel}で見る
          </a>
        )}
      </div>
    );
  }

  // Compact mode
  if (resolvedSize === 'compact') {
    const compactAffiliateUrl = getAffiliateUrl(product.affiliateUrl, affiliateUrlOptions);
    const showCompactCta = compactAffiliateUrl && !(hideFanzaPurchaseLinks && product.provider === 'fanza');

    return (
      <>
        <div className={`relative block ${themeConfig.cardBg} rounded-lg overflow-hidden hover:ring-2 ${themeConfig.cardHoverRing} transition-all group`}>
          <Link href={`/${locale}/products/${product.id}`}>
            <div className={`relative bg-gradient-to-br ${themeConfig.gradient}`} style={{ aspectRatio: '2/3' }}>
              <Image
                src={imgSrc}
                alt={product.title}
                fill
                className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[1px]' : ''}`}
                sizes="(max-width: 768px) 33vw, 12.5vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                onError={handleImageError}
                quality={75}
              />
              {product.salePrice && (
                <div className="absolute top-1 left-1 flex gap-1 z-10">
                  <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                    </svg>
                    SALE
                  </span>
                  {product.discount && product.discount >= 30 && (
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                      お得
                    </span>
                  )}
                </div>
              )}
              {/* 高評価バッジ */}
              {product.rating && product.rating >= 4.5 && (
                <div className="absolute bottom-1 right-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {product.rating.toFixed(1)}
                </div>
              )}
            </div>
            <div className="p-1.5">
              <h3 className={`text-xs font-medium ${themeConfig.textPrimary} line-clamp-2 leading-tight`}>{product.title}</h3>
              {/* 女優名リンク（導線強化） */}
              {product.performers && product.performers.length > 0 && (
                <div className="mt-1 truncate">
                  <Link
                    href={`/${locale}/actress/${product.performers[0].id}`}
                    className={`text-[10px] ${themeConfig.accentColor} hover:underline`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {product.performers[0].name}
                  </Link>
                </div>
              )}
            </div>
          </Link>

          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-0 left-0 z-20 bg-black/70 hover:bg-black/90 text-white min-w-[48px] min-h-[48px] flex items-center justify-center rounded-br-lg transition-all hover:scale-105"
              style={{ marginLeft: product.salePrice ? '40px' : '0' }}
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {(FavoriteButton || ViewedButton) && (
            <div className="absolute top-1 right-1 flex gap-0.5 z-20">
              {FavoriteButton && <FavoriteButton type="product" id={product.id} size="xs" />}
              {ViewedButton && (
                <ViewedButton
                  productId={String(product.id)}
                  title={product.title}
                  imageUrl={product.imageUrl ?? null}
                  aspName={product.providerLabel ?? product.provider ?? 'unknown'}
                  performerName={product.actressName ?? product.performers?.[0]?.name}
                  performerId={product.actressId ?? product.performers?.[0]?.id}
                  tags={product.tags}
                  duration={product.duration}
                  size="xs"
                  iconOnly
                />
              )}
            </div>
          )}

          {/* ホバー時CTA（compactモード） */}
          {showCompactCta && (
            <a
              href={compactAffiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => e.stopPropagation()}
              className={`absolute bottom-0 left-0 right-0 py-1.5 text-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 ${
                product.salePrice
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : theme === 'dark'
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                    : 'bg-gradient-to-r from-pink-500 to-rose-500'
              }`}
            >
              {product.providerLabel}で{product.salePrice ? 'お得に' : ''}見る
            </a>
          )}
        </div>

        {showVideoModal && primaryVideo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={handleCloseVideoModal}
          >
            <button
              type="button"
              onClick={handleCloseVideoModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
              aria-label={t('close')}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div
              className="relative w-full max-w-4xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src={primaryVideo.url}
                controls
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: '80vh' }}
              >
                {t('videoNotSupported')}
              </video>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full mode
  return (
    <div className={`${themeConfig.cardBg} rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300 border ${themeConfig.cardBorder}`}>
      <div className={`relative bg-gradient-to-br ${themeConfig.gradient}`} style={{ height: '18rem' }}>
        <div className="relative block h-full group">
          {/* Action buttons - positioned at top right of image container */}
          {(FavoriteButton || ViewedButton) && (
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
              {FavoriteButton && (
                <div className={`${themeConfig.favoriteButtonBg} rounded-full shadow-md`}>
                  <FavoriteButton type="product" id={product.id} />
                </div>
              )}
              {ViewedButton && (
                <ViewedButton
                  productId={product.id}
                  title={product.title}
                  imageUrl={product.imageUrl ?? null}
                  aspName={product.providerLabel ?? product.provider ?? 'unknown'}
                  performerName={product.actressName ?? product.performers?.[0]?.name}
                  performerId={product.actressId ?? product.performers?.[0]?.id}
                  tags={product.tags}
                  duration={product.duration}
                  size="sm"
                  iconOnly
                  className="shadow-md"
                />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleImageClick}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={t('enlargeImage')}
          />
          <Image
            src={imgSrc}
            alt={generateAltText(product)}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[1px]' : ''}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            onError={handleImageError}
            priority={false}
            quality={80}
          />
          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-0 left-0 z-20 bg-black/70 hover:bg-black/90 text-white min-w-[48px] min-h-[48px] rounded-br-xl transition-all hover:scale-105 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {hasValidImageUrl && !hasError && imgSrc !== resolvedPlaceholder && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
          {/* サンプルコンテンツ数バッジ */}
          {(product.sampleImages?.length || product.sampleVideos?.length) && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {product.sampleImages && product.sampleImages.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {product.sampleImages.length}
                </span>
              )}
              {product.sampleVideos && product.sampleVideos.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-600/80 text-white flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {product.sampleVideos.length}
                </span>
              )}
            </div>
          )}
          {(hasError || imgSrc === resolvedPlaceholder || !hasValidImageUrl) && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${themeConfig.noImageGradient}`}>
              <div className={`text-7xl mb-3 ${themeConfig.noImageEmoji}`}>📷</div>
              <span className={`inline-block px-4 py-1.5 ${themeConfig.noImageBadgeBg} ${themeConfig.noImageBadgeText} text-xs font-bold rounded-full shadow-md`}>
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
        {/* Urgency badge for sales ending within 48 hours */}
        {product.salePrice && product.saleEndAt && (() => {
          const endDate = new Date(product.saleEndAt);
          const now = new Date();
          const diffMs = endDate.getTime() - now.getTime();
          const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
          if (diffHours > 0 && diffHours <= 48) {
            const isVeryUrgent = diffHours <= 6;
            const isUrgent = diffHours <= 24;
            return (
              <div className="absolute top-4 right-4 z-20" style={{ marginTop: product.isFuture || product.isNew ? '0' : '0' }}>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 ${
                  isVeryUrgent
                    ? 'bg-red-600 text-white animate-pulse'
                    : isUrgent
                      ? `${themeConfig.urgencyBadgeBg} ${themeConfig.urgencyBadgeText} animate-pulse`
                      : 'bg-yellow-500 text-black'
                }`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {diffHours <= 1 ? t('urgentLastHour') : diffHours <= 24 ? t('urgentEndsIn', { hours: diffHours }) : t('urgentEndsSoon', { hours: diffHours })}
                </span>
              </div>
            );
          }
          return null;
        })()}
        {product.productType === 'dvd' && (
          <div className="absolute top-4 left-4" style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white shadow-lg">
              DVD
            </span>
          </div>
        )}
        {product.productType === 'monthly' && (
          <div className="absolute top-4 left-4" style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-lg">
              {t('monthly')}
            </span>
          </div>
        )}
        {rankPosition && rankPosition <= 10 && (
          <div className="absolute top-14 right-4 z-20">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-lg ${
              rankPosition === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black' :
              rankPosition === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black' :
              rankPosition === 3 ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white' :
              `${themeConfig.rankingDefaultBg} ${themeConfig.rankingDefaultText} border ${themeConfig.rankingDefaultBorder}`
            }`}>
              {rankPosition <= 3 ? `🏆 ${rankPosition}位` : `${rankPosition}位`}
            </span>
          </div>
        )}
        {product.discount && !product.salePrice && (
          <span className={`absolute bottom-4 right-4 ${themeConfig.badgeBg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
            {product.discount}%OFF
          </span>
        )}
        {(product.salePrice || product.price > 0) && (() => {
          const priceVariant = resolvedGetVariant('priceDisplayStyle');
          const isEmphasized = priceVariant === 'emphasized';
          const countdownVariant = resolvedGetVariant('saleCountdownStyle');
          const isAnimated = countdownVariant === 'animated';

          return (
            <div className={`absolute bottom-4 left-4 ${themeConfig.priceBadgeBg} backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border ${themeConfig.priceBadgeBorder}`}>
              {product.salePrice ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${themeConfig.salePriceColor} ${isEmphasized ? 'text-base' : 'text-sm'}`}>
                      {resolvedFormatPrice(product.salePrice, product.currency)}
                    </span>
                    {product.discount && (
                      <>
                        <span className={`font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} px-1 py-0.5 rounded ${isEmphasized ? 'text-xs' : 'text-[10px]'}`}>
                          -{product.discount}%
                        </span>
                        {product.discount >= 30 && (
                          <span className="font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500 px-1.5 py-0.5 rounded text-[10px]">
                            お得
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {product.saleEndAt && (() => {
                    const endDate = new Date(product.saleEndAt);
                    const now = new Date();
                    const diffMs = endDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0) return null;
                    if (diffDays <= 3) {
                      return (
                        <span className={`text-[10px] font-bold ${themeConfig.countdownColor} ${isAnimated ? 'animate-pulse' : ''}`}>
                          {diffDays === 1 ? '⏰ ' + t('saleTomorrow') : `⏰ ${t('saleEndsIn', { days: diffDays })}`}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <span className={`font-bold ${themeConfig.regularPriceColor} ${isEmphasized ? 'text-base' : 'text-sm'}`}>
                  {resolvedFormatPrice(product.price, product.currency)}
                </span>
              )}
            </div>
          );
        })()}
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-1">
        <div>
          <div className={`text-[10px] sm:text-xs ${themeConfig.textSecondary} flex items-center gap-1 truncate`}>
            {product.actressId ? (
              <Link
                href={`/${locale}/actress/${product.actressId}`}
                className={`inline-flex items-center gap-0.5 ${themeConfig.accentColor} ${themeConfig.accentHover} hover:underline underline-offset-2 transition-colors font-medium truncate`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate">{product.actressName ?? t('performerInfo')}</span>
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {product.performers.slice(0, 2).map((performer, index) => (
                  <span key={performer.id}>
                    <Link
                      href={`/${locale}/actress/${performer.id}`}
                      className={`${themeConfig.accentColor} ${themeConfig.accentHover} hover:underline underline-offset-2 transition-colors font-medium`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {performer.name}
                    </Link>
                    {index < Math.min(product.performers!.length, 2) - 1 && <span className={`mx-0.5 ${themeConfig.separatorColor}`}>/</span>}
                  </span>
                ))}
              </span>
            ) : (
              <span className={`${themeConfig.textMuted} truncate`}>{product.actressName ?? t('performerInfo')}</span>
            )}
            <span className={`${themeConfig.separatorColor} shrink-0`}>|</span>
            <span className={`${themeConfig.textMuted} shrink-0`}>{product.releaseDate ?? t('releaseDateTbd')}</span>
          </div>
          <Link href={`/${locale}/products/${product.id}`}>
            <p className={`text-[10px] sm:text-xs ${themeConfig.textMuted} mt-0.5 truncate`}>
              {product.normalizedProductId || product.id}
            </p>
            <h3 className={`font-semibold text-sm sm:text-base leading-tight mt-0.5 line-clamp-2 ${themeConfig.textPrimary} hover:opacity-80`}>
              {product.title}
            </h3>
          </Link>
        </div>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={getTagFilterUrl(tag)}
                className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${themeConfig.tagBg} ${themeConfig.tagText} ${themeConfig.tagHoverBg} ${themeConfig.tagHoverText} transition-all`}
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {(product.rating || product.duration) && (
          <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs ${themeConfig.textSecondary}`}>
            {product.rating && StarRating && (
              <StarRating
                rating={product.rating}
                reviewCount={product.reviewCount}
                size="sm"
                showCount={true}
              />
            )}
            {/* 人気バッジ: 高評価かつレビュー多数 */}
            {product.rating && product.rating >= 4.5 && product.reviewCount && product.reviewCount >= 20 && (
              <span className="text-[10px] font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                人気
              </span>
            )}
            {product.duration && <span className="shrink-0">・{product.duration}分</span>}
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          {product.salePrice && product.regularPrice ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className={`text-base sm:text-lg font-semibold ${themeConfig.salePriceColor}`}>
                  {resolvedFormatPrice(product.salePrice, product.currency)}
                </p>
                <p className={`text-[10px] sm:text-xs ${themeConfig.textMuted} line-through`}>
                  {resolvedFormatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <>
                    <span className={`text-[10px] font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} px-1 py-0.5 rounded`}>
                      -{product.discount}%
                    </span>
                    {product.discount >= 30 && (
                      <span className="text-[10px] font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500 px-1.5 py-0.5 rounded">
                        お得
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <p className={`text-base sm:text-lg font-semibold ${themeConfig.regularPriceColor}`}>
              {resolvedFormatPrice(product.price, product.currency)}
            </p>
          ) : (product.provider && isSubscriptionSite(product.provider)) ? (
            <p className={`text-sm font-semibold ${themeConfig.subscriptionColor}`}>
              {t('subscriptionOnly')}
            </p>
          ) : null}

          {(() => {
            const affiliateUrl = getAffiliateUrl(product.affiliateUrl, affiliateUrlOptions);
            if (!affiliateUrl) return null;
            if (hideFanzaPurchaseLinks && product.provider === 'fanza') return null;
            const isSale = !!product.salePrice;

            const ctaVariant = resolvedGetVariant('ctaButtonText');
            const getCtaText = () => {
              const provider = product.providerLabel;
              if (isSale) {
                switch (ctaVariant) {
                  case 'urgency': return `${provider}で今すぐ購入`;
                  case 'action': return `${provider}でお得にゲット`;
                  default: return `${provider}でお得に購入`;
                }
              } else {
                switch (ctaVariant) {
                  case 'urgency': return `${provider}で今すぐ見る`;
                  case 'action': return `${provider}をチェック`;
                  default: return `${provider}で見る`;
                }
              }
            };

            return (
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={handleCtaClick}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg w-full px-3 py-2.5 text-sm font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ${
                  isSale
                    ? `bg-gradient-to-r ${themeConfig.ctaSaleGradient} text-white ${themeConfig.ctaSaleGradientHover}`
                    : `bg-gradient-to-r ${themeConfig.ctaGradient} text-white ${themeConfig.ctaGradientHover}`
                }`}
                title={`${product.providerLabel}で購入`}
                aria-label={`${product.providerLabel}で購入（外部リンク）`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="truncate">
                  {getCtaText()}
                </span>
              </a>
            );
          })()}

          {/* 他のASPで購入オプション - ポップオーバー形式で画面ずれを防止 */}
          {product.alternativeSources && product.alternativeSources.length > 0 && (
            <div className="mt-1.5 relative">
              <details className="group">
                <summary className={`flex items-center justify-center gap-1 text-[10px] ${themeConfig.textMuted} cursor-pointer hover:text-gray-400 transition-colors list-none [&::-webkit-details-marker]:hidden`}>
                  <span>他{product.alternativeSources.length}社でも購入可</span>
                  <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                {/* 絶対位置でポップオーバー表示 - カード高さに影響しない、画面外はみ出し防止 */}
                <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-max max-w-[90vw] p-2 rounded-lg shadow-lg z-50 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                  <div className="flex flex-wrap gap-1">
                    {product.alternativeSources.map((source, idx) => {
                      // 内部リンクを使用（SEO・回遊率向上のため）
                      const href = `/${locale}/products/${source.productId}`;
                      return (
                        <a
                          key={idx}
                          href={href}
                          className={`text-[10px] px-2 py-1 rounded ${themeConfig.tagBg} ${themeConfig.tagText} hover:opacity-80 transition-opacity flex items-center gap-1`}
                        >
                          <span className="font-medium">{source.aspName}</span>
                          <span>{resolvedFormatPrice(source.salePrice || source.price)}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {ImageLightbox && (
        <ImageLightbox
          images={allImages}
          initialIndex={modalImageIndex}
          isOpen={showModal}
          onClose={handleCloseModal}
          alt={generateAltText(product)}
          detailsUrl={`/${locale}/products/${product.id}`}
        />
      )}

      {showVideoModal && primaryVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={handleCloseVideoModal}
        >
          <button
            type="button"
            onClick={handleCloseVideoModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
            aria-label={t('close')}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative w-full max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={primaryVideo.url}
              controls
              autoPlay
              className="w-full rounded-lg"
              style={{ maxHeight: '80vh' }}
            >
              {t('videoNotSupported')}
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProductCardBase, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.salePrice === nextProps.product.salePrice &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.rankPosition === nextProps.rankPosition &&
    prevProps.compact === nextProps.compact &&
    prevProps.size === nextProps.size &&
    prevProps.theme === nextProps.theme &&
    prevProps.placeholderImage === nextProps.placeholderImage &&
    prevProps.hideFanzaPurchaseLinks === nextProps.hideFanzaPurchaseLinks
  );
});
