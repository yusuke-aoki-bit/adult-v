'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useCallback, type ReactNode, type ComponentType } from 'react';
import { useParams } from 'next/navigation';
import type { Actress, ProviderId } from '../../types/product';
import { providerMeta } from '../../providers';
import { normalizeImageUrl, isUncensoredThumbnail } from '../../lib/image-utils';
import ImageLightbox from '../ImageLightbox';
import { getActressCardThemeConfig, filterServicesForSite, type ActressCardTheme } from './themes';

// Client-side translations
const translations = {
  ja: {
    releaseCount: '出演数',
    videos: '本',
    trend: 'トレンド',
    fanScore: 'ファン度',
  },
  en: {
    releaseCount: 'Releases',
    videos: '',
    trend: 'Trend',
    fanScore: 'Fan Score',
  },
  zh: {
    releaseCount: '出演数',
    videos: '部',
    trend: '趋势',
    fanScore: '粉丝分',
  },
  ko: {
    releaseCount: '출연작',
    videos: '편',
    trend: '트렌드',
    fanScore: '팬점수',
  },
} as const;

interface FavoriteButtonProps {
  type: 'actress' | 'product';
  id: string;
}

export type ActressCardSize = 'full' | 'compact' | 'mini';

export interface ActressCardBaseProps {
  actress: Actress;
  /** @deprecated Use size prop instead */
  compact?: boolean;
  /** Card size: 'full', 'compact', or 'mini' */
  size?: ActressCardSize;
  priority?: boolean;
  theme: ActressCardTheme;
  /** FavoriteButton component from the app */
  FavoriteButton?: ComponentType<FavoriteButtonProps>;
  /** Whether this is FANZA site (to filter services) */
  isFanzaSite?: boolean;
  /** Function to fetch product images for lightbox */
  fetchProductImages?: (actressId: string) => Promise<string[]>;
}

/**
 * Shared ActressCard component
 * Used by both apps/web and apps/fanza
 */
export function ActressCardBase({
  actress,
  compact = false,
  size,
  priority = false,
  theme,
  FavoriteButton,
  isFanzaSite = false,
  fetchProductImages,
}: ActressCardBaseProps): ReactNode {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const themeConfig = getActressCardThemeConfig(theme);

  // Resolve size from either new size prop or deprecated compact prop
  const resolvedSize: ActressCardSize = size ?? (compact ? 'compact' : 'full');

  // Filter services based on site
  const displayServices = filterServicesForSite(actress.services, isFanzaSite);

  // Image handling
  const rawImageUrl = compact
    ? (actress.thumbnail || actress.heroImage)
    : (actress.heroImage || actress.thumbnail);
  const initialSrc = normalizeImageUrl(rawImageUrl);
  const [imgSrc, setImgSrc] = useState(initialSrc || themeConfig.placeholderImage);
  const [hasError, setHasError] = useState(!initialSrc);

  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);

  // Check if uncensored thumbnail (for blur)
  const shouldBlur = isUncensoredThumbnail(rawImageUrl);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(themeConfig.placeholderImage);
    }
  };

  // Image click handler for lightbox
  const handleImageClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!fetchProductImages) return;

    try {
      const images = await fetchProductImages(actress.id);
      setProductImages(images);
      if (images.length > 0) {
        setShowLightbox(true);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [actress.id, fetchProductImages]);

  const handleCloseLightbox = useCallback(() => {
    setShowLightbox(false);
  }, []);

  // Mini size - simplest card for WeeklyHighlights, etc.
  if (resolvedSize === 'mini') {
    return (
      <Link
        href={`/${locale}/actress/${actress.id}`}
        className={`group ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500/50 transition-all`}
      >
        <div className={`aspect-square relative ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
          {actress.heroImage || actress.thumbnail ? (
            <Image
              src={imgSrc}
              alt={actress.name}
              fill
              sizes="(max-width: 768px) 33vw, 10vw"
              className={`object-cover group-hover:scale-105 transition-transform duration-300 ${shouldBlur ? 'blur-[1px]' : ''}`}
              loading={priority ? undefined : "lazy"}
              priority={priority}
              onError={handleImageError}
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className={`h-8 w-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          {actress.metrics?.trendingScore && actress.metrics.trendingScore > 0 && (
            <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {actress.metrics.trendingScore}%
            </div>
          )}
        </div>
        <div className="p-1.5">
          <p className={`${theme === 'dark' ? 'text-gray-200 group-hover:text-amber-300' : 'text-gray-800 group-hover:text-amber-600'} text-xs font-medium truncate transition-colors`}>
            {actress.name}
          </p>
        </div>
      </Link>
    );
  }

  if (resolvedSize === 'compact') {
    return (
      <>
        <div className="theme-card theme-text rounded-lg overflow-hidden hover:shadow-xl transition-all duration-200">
          {/* Image section - click for modal */}
          <div
            role="button"
            tabIndex={0}
            onClick={fetchProductImages ? handleImageClick : undefined}
            onKeyDown={(e) => {
              if (fetchProductImages && (e.key === 'Enter' || e.key === ' ')) {
                handleImageClick(e as unknown as React.MouseEvent);
              }
            }}
            className={`relative w-full block ${fetchProductImages ? 'cursor-pointer' : ''} group`}
            style={{ aspectRatio: '3/4' }}
          >
            <Image
              src={imgSrc}
              alt={actress.name}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 16vw"
              className={`object-cover opacity-90 group-hover:scale-105 transition-transform duration-300 ${shouldBlur ? 'blur-[1px]' : ''}`}
              loading={priority ? undefined : "lazy"}
              priority={priority}
              fetchPriority={priority ? "high" : "auto"}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              onError={handleImageError}
              unoptimized
            />
            {/* Favorite button */}
            {FavoriteButton && (
              <div
                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-white rounded-full shadow-md scale-90 sm:scale-100 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <FavoriteButton type="actress" id={actress.id} />
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>

          {/* Name and info section */}
          <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
            {/* Name - link to detail page */}
            <Link
              href={`/${locale}/actress/${actress.id}`}
              className={`block text-sm sm:text-base font-semibold truncate leading-tight ${themeConfig.hoverColor} transition-colors`}
            >
              {actress.name}
            </Link>
            {/* Aliases (desktop only) */}
            {actress.aliases && actress.aliases.length > 0 && (
              <p className="hidden sm:block text-[10px] theme-text-muted truncate">
                ({actress.aliases.slice(0, 2).join(', ')}{actress.aliases.length > 2 ? ' ...' : ''})
              </p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted hidden sm:inline">{t.releaseCount}</span>
              <span className="font-semibold">{actress.metrics?.releaseCount || 0}{t.videos}</span>
            </div>
            {displayServices.length > 0 && (
              <div className="flex flex-wrap gap-0.5 sm:gap-1 min-h-[18px]">
                {displayServices.slice(0, 3).map((service) => {
                  const meta = providerMeta[service as ProviderId];
                  if (!meta) return null;
                  return (
                    <span
                      key={service}
                      className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded bg-gradient-to-r text-white ${meta.accentClass}`}
                    >
                      {meta.label}
                    </span>
                  );
                })}
                {displayServices.length > 3 && (
                  <span className="text-[9px] sm:text-[10px] theme-text-muted">+{displayServices.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Product images lightbox */}
        <ImageLightbox
          images={productImages}
          isOpen={showLightbox}
          onClose={handleCloseLightbox}
          alt={actress.name}
        />
      </>
    );
  }

  // Full display mode
  return (
    <div className="theme-card theme-text rounded-2xl overflow-hidden">
      <div className="relative aspect-4/5">
        <Image
          src={imgSrc}
          alt={actress.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover opacity-90 ${shouldBlur ? 'blur-[1px]' : ''}`}
          loading="lazy"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          onError={handleImageError}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        {FavoriteButton && (
          <div className="absolute top-4 right-4 bg-white rounded-full shadow-md">
            <FavoriteButton type="actress" id={actress.id} />
          </div>
        )}
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-sm uppercase tracking-widest text-white/70">
            {actress.catchcopy}
          </p>
          <h3 className="text-3xl font-semibold">{actress.name}</h3>
          {/* Aliases */}
          {actress.aliases && actress.aliases.length > 0 && (
            <p className="text-sm text-white/60 mt-1">
              ({actress.aliases.slice(0, 3).join(', ')}{actress.aliases.length > 3 ? ' ...' : ''})
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* AI review or description */}
        {actress.aiReview?.overview ? (
          <p className="text-sm theme-text-secondary line-clamp-3">{actress.aiReview.overview}</p>
        ) : actress.description && (
          <p className="text-sm theme-text-secondary line-clamp-3">{actress.description}</p>
        )}

        {actress.tags && actress.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actress.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs uppercase tracking-wide theme-content theme-text-secondary px-3 py-1 rounded-full border theme-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {actress.metrics && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label={t.releaseCount} value={`${actress.metrics.releaseCount || 0}${t.videos}`} />
            <Stat label={t.trend} value={actress.metrics.trendingScore || 0} />
            <Stat label={t.fanScore} value={`${actress.metrics.fanScore || 0}%`} />
          </div>
        )}

        {displayServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {displayServices.map((service) => {
              const meta = providerMeta[service as ProviderId];
              if (!meta) return null;
              return (
                <span
                  key={service}
                  className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r text-white ${meta.accentClass}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="theme-content rounded-xl py-3 border theme-border">
      <div className="text-xs theme-text-muted">{label}</div>
      <div className="text-lg font-semibold theme-text">{value}</div>
    </div>
  );
}
