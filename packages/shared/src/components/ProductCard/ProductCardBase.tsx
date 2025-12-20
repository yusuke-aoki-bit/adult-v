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

export interface ProductCardBaseProps {
  product: Product;
  /** Theme: 'dark' for adult-v, 'light' for fanza */
  theme: ProductCardTheme;
  /** Ranking position (1-10 shows badge) */
  rankPosition?: number;
  /** Compact mode for grid display */
  compact?: boolean;
  /** Placeholder image URL */
  placeholderImage: string;
  /** FavoriteButton component from app */
  FavoriteButton: ComponentType<{ type: 'product'; id: string | number; size?: string }>;
  /** ViewedButton component from app */
  ViewedButton: ComponentType<{
    productId: string;
    title: string;
    imageUrl: string | null;
    aspName: string;
    performerName?: string;
    performerId?: string | number;
    tags?: string[];
    duration?: number;
    size?: string;
    iconOnly?: boolean;
    className?: string;
  }>;
  /** ImageLightbox component from app */
  ImageLightbox: ComponentType<{
    images: string[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
    alt: string;
    detailsUrl?: string;
  }>;
  /** StarRating component from app */
  StarRating: ComponentType<{
    rating: number;
    reviewCount?: number;
    size?: string;
    showCount?: boolean;
  }>;
  /** Format price function */
  formatPrice: (price: number, currency?: string) => string;
  /** Get A/B test variant */
  getVariant: (testName: string) => string;
  /** Track CTA click */
  trackCtaClick: (testName: string, productId: string | number, params: Record<string, unknown>) => void;
  /** Affiliate URL options */
  affiliateUrlOptions?: GetAffiliateUrlOptions;
  /** Whether to hide FANZA purchase links (for adult-v site) */
  hideFanzaPurchaseLinks?: boolean;
}

function ProductCardBase({
  product,
  theme,
  rankPosition,
  compact = false,
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

  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : placeholderImage);
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

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(placeholderImage);
    }
  };

  const isUncensored = isDtiUncensoredSite(imgSrc);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imgSrc !== placeholderImage && hasValidImageUrl && !hasError) {
      setShowModal(true);
    }
  }, [imgSrc, hasValidImageUrl, hasError, placeholderImage]);

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

  // Compact mode
  if (compact) {
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
              />
              {product.salePrice && (
                <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
                  SALE
                </div>
              )}
            </div>
            <div className="p-1.5">
              <h3 className={`text-xs font-medium ${themeConfig.textPrimary} line-clamp-2 leading-tight`}>{product.title}</h3>
            </div>
          </Link>

          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-1 left-1 z-20 bg-black/70 hover:bg-black/90 text-white p-1 rounded-full transition-all hover:scale-110"
              style={{ marginLeft: product.salePrice ? '40px' : '0' }}
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          <div className="absolute top-1 right-1 flex gap-0.5 z-20">
            <FavoriteButton type="product" id={product.id} size="xs" />
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
          </div>
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
              className="absolute top-2 left-2 z-20 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-all hover:scale-110 flex items-center gap-1"
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {hasValidImageUrl && !hasError && imgSrc !== placeholderImage && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
          {(hasError || imgSrc === placeholderImage || !hasValidImageUrl) && (
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
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
          <div className={`${themeConfig.favoriteButtonBg} rounded-full shadow-md`}>
            <FavoriteButton type="product" id={product.id} />
          </div>
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
        </div>
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
          const priceVariant = getVariant('priceDisplayStyle');
          const isEmphasized = priceVariant === 'emphasized';
          const countdownVariant = getVariant('saleCountdownStyle');
          const isAnimated = countdownVariant === 'animated';

          return (
            <div className={`absolute bottom-4 left-4 ${themeConfig.priceBadgeBg} backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border ${themeConfig.priceBadgeBorder}`}>
              {product.salePrice ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${themeConfig.salePriceColor} ${isEmphasized ? 'text-base' : 'text-sm'}`}>
                      {formatPrice(product.salePrice, product.currency)}
                    </span>
                    {product.discount && (
                      <span className={`font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} px-1 py-0.5 rounded ${isEmphasized ? 'text-xs' : 'text-[10px]'}`}>
                        -{product.discount}%
                      </span>
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
                  {formatPrice(product.price, product.currency)}
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
                className={`${themeConfig.accentColor} ${themeConfig.accentHover} hover:underline underline-offset-2 transition-colors font-medium truncate`}
                onClick={(e) => e.stopPropagation()}
              >
                {product.actressName ?? t('performerInfo')}
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              <span className="truncate">
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
            {product.rating && (
              <StarRating
                rating={product.rating}
                reviewCount={product.reviewCount}
                size="sm"
                showCount={true}
              />
            )}
            {product.duration && <span className="shrink-0">・{product.duration}分</span>}
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          {product.salePrice && product.regularPrice ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className={`text-base sm:text-lg font-semibold ${themeConfig.salePriceColor}`}>
                  {formatPrice(product.salePrice, product.currency)}
                </p>
                <p className={`text-[10px] sm:text-xs ${themeConfig.textMuted} line-through`}>
                  {formatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <span className={`text-[10px] font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} px-1 py-0.5 rounded`}>
                    -{product.discount}%
                  </span>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <p className={`text-base sm:text-lg font-semibold ${themeConfig.regularPriceColor}`}>
              {formatPrice(product.price, product.currency)}
            </p>
          ) : isSubscriptionSite(product.provider) ? (
            <p className={`text-sm font-semibold ${themeConfig.subscriptionColor}`}>
              {t('subscriptionOnly')}
            </p>
          ) : null}

          {(() => {
            const affiliateUrl = getAffiliateUrl(product.affiliateUrl, affiliateUrlOptions);
            if (!affiliateUrl) return null;
            if (hideFanzaPurchaseLinks && product.provider === 'fanza') return null;
            const isSale = !!product.salePrice;

            const ctaVariant = getVariant('ctaButtonText');
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

            const handleCtaClick = () => {
              trackCtaClick('ctaButtonText', product.id, {
                is_sale: isSale,
                provider: product.provider,
              });
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
        </div>
      </div>

      <ImageLightbox
        images={allImages}
        initialIndex={modalImageIndex}
        isOpen={showModal}
        onClose={handleCloseModal}
        alt={generateAltText(product)}
        detailsUrl={`/${locale}/products/${product.id}`}
      />

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
    prevProps.rankPosition === nextProps.rankPosition &&
    prevProps.compact === nextProps.compact &&
    prevProps.theme === nextProps.theme
  );
});
