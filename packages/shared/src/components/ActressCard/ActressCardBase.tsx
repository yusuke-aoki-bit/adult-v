'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
  type ReactNode,
  type ComponentType,
} from 'react';
import { useParams } from 'next/navigation';
import type { Actress, ProviderId } from '../../types/product';
import { providerMeta } from '../../lib/providers';
import { normalizeImageUrl, isUncensoredThumbnail } from '../../lib/image-utils';
import ImageLightbox from '../ImageLightbox';
import { CopyButton } from '../CopyButton';
import { getActressCardThemeConfig, filterServicesForSite, type ActressCardTheme } from './themes';
import { generateActressAltText } from '../../lib/seo-utils';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, actressCardTranslations } from '../../lib/translations';

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
  /** Theme: 'dark' for adult-v, 'light' for fanza. Falls back to SiteThemeContext if omitted. */
  theme?: ActressCardTheme;
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
function ActressCardBaseComponent({
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
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getTranslation(actressCardTranslations, locale);
  const siteTheme = useSiteTheme();
  const resolvedTheme: ActressCardTheme = theme ?? siteTheme.theme;
  const themeConfig = getActressCardThemeConfig(resolvedTheme);

  // Resolve size from either new size prop or deprecated compact prop
  const resolvedSize: ActressCardSize = size ?? (compact ? 'compact' : 'full');

  // Filter services based on site - memoized to avoid recalculation
  const displayServices = useMemo(
    () => filterServicesForSite(actress.services, isFanzaSite),
    [actress.services, isFanzaSite],
  );

  // SEO optimized alt text
  const altText = useMemo(
    () =>
      generateActressAltText({
        name: actress['name'],
        productCount: actress['releaseCount'] || actress.metrics?.releaseCount,
        services: actress.services,
        aliases: actress.aliases,
      }),
    [actress['name'], actress['releaseCount'], actress.metrics?.releaseCount, actress.services, actress.aliases],
  );

  // Image handling
  const rawImageUrl = compact
    ? actress['thumbnail'] || actress['heroImage']
    : actress['heroImage'] || actress['thumbnail'];
  const initialSrc = normalizeImageUrl(rawImageUrl);
  const [imgSrc, setImgSrc] = useState(initialSrc || themeConfig.placeholderImage);
  const [hasError, setHasError] = useState(!initialSrc);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);

  // Check if uncensored thumbnail (for blur)
  const shouldBlur = isUncensoredThumbnail(rawImageUrl);

  const handleImageError = useCallback(() => {
    if (retryCount < MAX_RETRIES && initialSrc) {
      // タイムアウトやネットワークエラーの場合は遅延後に再試行
      const delay = (retryCount + 1) * 500; // 500ms, 1000ms
      retryTimerRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        // キャッシュ回避のためタイムスタンプを付与
        const retryUrl = initialSrc.includes('?')
          ? `${initialSrc}&_retry=${retryCount + 1}&_t=${Date.now()}`
          : `${initialSrc}?_retry=${retryCount + 1}&_t=${Date.now()}`;
        setImgSrc(retryUrl);
      }, delay);
    } else if (!hasError) {
      setHasError(true);
      setImgSrc(themeConfig.placeholderImage);
    }
  }, [retryCount, initialSrc, hasError, themeConfig.placeholderImage]);

  // Image click/keydown handler for lightbox
  const handleImageClick = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!fetchProductImages) return;

      try {
        const images = await fetchProductImages(actress['id']);
        setProductImages(images);
        if (images.length > 0) {
          setShowLightbox(true);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    },
    [actress['id'], fetchProductImages],
  );

  const handleCloseLightbox = useCallback(() => {
    setShowLightbox(false);
  }, []);

  // Mini size - simplest card for WeeklyHighlights, etc.
  if (resolvedSize === 'mini') {
    return (
      <Link
        href={`/${locale}/actress/${actress['id']}`}
        className={`group ${resolvedTheme === 'dark' ? 'bg-[#16161f]' : 'bg-white'} overflow-hidden rounded-xl transition-all duration-200 hover:shadow-md hover:ring-1 ${resolvedTheme === 'dark' ? 'hover:ring-white/10' : 'hover:ring-gray-300'}`}
      >
        <div className={`relative aspect-square ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
          {actress['heroImage'] || actress['thumbnail'] ? (
            <Image
              src={imgSrc}
              alt={altText}
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 15vw, 8vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${shouldBlur ? 'blur-[1px]' : ''}`}
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              fetchPriority={priority ? 'high' : 'low'}
              quality={75}
              onError={handleImageError}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <svg
                className={`h-8 w-8 ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
          {/* トレンドバッジ */}
          {actress.metrics?.trendingScore && actress.metrics.trendingScore > 0 && (
            <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded-md bg-linear-to-r from-green-500 to-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {actress.metrics.trendingScore}%
            </div>
          )}
          {/* 出演作品数オーバーレイ（ホバー時） */}
          {actress['releaseCount'] && actress['releaseCount'] > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="text-sm font-bold text-white">{actress['releaseCount']}本</span>
            </div>
          )}
        </div>
        <div className="p-2">
          <div className="flex items-center gap-1">
            <p
              className={`${resolvedTheme === 'dark' ? 'text-gray-200 group-hover:text-fuchsia-300' : 'text-gray-800 group-hover:text-pink-600'} flex-1 truncate text-xs font-medium transition-colors`}
            >
              {actress['name']}
            </p>
            <CopyButton
              text={actress['name']}
              iconOnly
              size="xs"
              className={
                resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800' : ''
              }
            />
          </div>
          {/* メトリクス表示（作品数がある場合） */}
          {actress['releaseCount'] && actress['releaseCount'] > 0 && (
            <p className={`text-[10px] ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
              {t.releaseCount}: {actress['releaseCount']}
              {t.videos}
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (resolvedSize === 'compact') {
    return (
      <>
        <article className="theme-card theme-text overflow-hidden rounded-xl transition-all duration-200 hover:shadow-md hover:ring-1 hover:ring-white/10">
          {/* Image section - click for modal */}
          <div
            role="button"
            tabIndex={0}
            onClick={fetchProductImages ? handleImageClick : undefined}
            onKeyDown={(e) => {
              if (fetchProductImages && (e.key === 'Enter' || e.key === ' ')) {
                handleImageClick(e);
              }
            }}
            className={`relative block w-full ${fetchProductImages ? 'cursor-pointer' : ''} group`}
            style={{ aspectRatio: '3/4' }}
          >
            <Image
              src={imgSrc}
              alt={altText}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 18vw, 12vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${shouldBlur ? 'blur-[1px]' : ''}`}
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              fetchPriority={priority ? 'high' : 'low'}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              onError={handleImageError}
              quality={75}
            />
            {/* Favorite button */}
            {FavoriteButton && (
              <div
                className="absolute top-1.5 right-1.5 z-10 scale-90 rounded-full bg-white shadow-md sm:top-2 sm:right-2 sm:scale-100"
                onClick={(e) => e.stopPropagation()}
              >
                <FavoriteButton type="actress" id={actress['id']} />
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
          </div>

          {/* Name and info section */}
          <div className="space-y-1.5 p-2 sm:space-y-2 sm:p-3">
            {/* Name - link to detail page with copy button */}
            <div className="flex items-center gap-1">
              <Link
                href={`/${locale}/actress/${actress['id']}`}
                className={`truncate text-sm leading-tight font-semibold sm:text-base ${themeConfig.hoverColor} flex-1 transition-colors`}
              >
                {actress['name']}
              </Link>
              <CopyButton
                text={actress['name']}
                iconOnly
                size="xs"
                className={
                  resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800' : ''
                }
              />
            </div>
            {/* Aliases (desktop only) */}
            {actress.aliases && actress.aliases.length > 0 && (
              <p className="theme-text-muted hidden truncate text-[10px] sm:block">
                ({actress.aliases.slice(0, 2).join(', ')}
                {actress.aliases.length > 2 ? ' ...' : ''})
              </p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted hidden sm:inline">{t.releaseCount}</span>
              <span className="font-semibold">
                {actress.metrics?.releaseCount || 0}
                {t.videos}
              </span>
            </div>
            {displayServices.length > 0 && (
              <div className="flex min-h-[18px] flex-wrap gap-0.5 sm:gap-1">
                {displayServices.slice(0, 3).map((service) => {
                  const meta = providerMeta[service as ProviderId];
                  if (!meta) return null;
                  const gradientStyle = meta.gradientColors
                    ? {
                        background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`,
                      }
                    : { backgroundColor: '#4b5563' };
                  return (
                    <span
                      key={service}
                      className="rounded px-1 py-0.5 text-[9px] font-semibold text-white sm:px-1.5 sm:text-[10px]"
                      style={gradientStyle}
                    >
                      {meta.label}
                    </span>
                  );
                })}
                {displayServices.length > 3 && (
                  <span className="theme-text-muted text-[9px] sm:text-[10px]">+{displayServices.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </article>

        {/* Product images lightbox */}
        <ImageLightbox
          images={productImages}
          isOpen={showLightbox}
          onClose={handleCloseLightbox}
          alt={actress['name']}
        />
      </>
    );
  }

  // Full display mode - same interaction as compact (image click = lightbox, name click = detail)
  return (
    <>
      <article className="theme-card theme-text overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-xl">
        {/* Image section - click for lightbox */}
        <div
          role="button"
          tabIndex={0}
          onClick={fetchProductImages ? handleImageClick : undefined}
          onKeyDown={(e) => {
            if (fetchProductImages && (e.key === 'Enter' || e.key === ' ')) {
              handleImageClick(e);
            }
          }}
          className={`relative aspect-4/5 ${fetchProductImages ? 'cursor-pointer' : ''} group`}
        >
          <Image
            src={imgSrc}
            alt={altText}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover opacity-90 transition-transform duration-300 group-hover:scale-105 ${shouldBlur ? 'blur-[1px]' : ''}`}
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            fetchPriority={priority ? 'high' : 'low'}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
          />
          {/* Favorite button */}
          {FavoriteButton && (
            <div
              className="absolute top-3 right-3 z-10 rounded-full bg-white shadow-md sm:top-4 sm:right-4"
              onClick={(e) => e.stopPropagation()}
            >
              <FavoriteButton type="actress" id={actress['id']} />
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
        </div>

        {/* Name and info section - below image */}
        <div className="space-y-3 p-4 sm:space-y-4 sm:p-6">
          {/* Name - link to detail page */}
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/actress/${actress['id']}`}
              className={`truncate text-xl leading-tight font-bold sm:text-2xl ${themeConfig.hoverColor} flex-1 transition-colors`}
            >
              {actress['name']}
            </Link>
            <CopyButton
              text={actress['name']}
              iconOnly
              size="sm"
              className={
                resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800' : ''
              }
            />
          </div>

          {/* Catchcopy */}
          {actress.catchcopy && <p className="theme-text-muted text-sm">{actress.catchcopy}</p>}

          {/* Aliases */}
          {actress.aliases && actress.aliases.length > 0 && (
            <p className="theme-text-muted text-xs">
              ({actress.aliases.slice(0, 3).join(', ')}
              {actress.aliases.length > 3 ? ' ...' : ''})
            </p>
          )}

          {/* AI review or description */}
          {actress.aiReview?.overview ? (
            <p className="theme-text-secondary line-clamp-3 text-sm">{actress.aiReview.overview}</p>
          ) : (
            actress['description'] && (
              <p className="theme-text-secondary line-clamp-3 text-sm">{actress['description']}</p>
            )
          )}

          {actress.tags && actress.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actress.tags.map((tag) => (
                <span
                  key={tag}
                  className="theme-content theme-text-secondary theme-border rounded-full border px-3 py-1 text-xs tracking-wide uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {actress.metrics && (
            <div className="flex flex-wrap justify-center gap-3 text-center sm:gap-4">
              <Stat label={t.releaseCount} value={`${actress.metrics.releaseCount || 0}${t.videos}`} />
              {(actress.metrics.trendingScore ?? 0) > 0 && (
                <Stat label={t.trend} value={actress.metrics.trendingScore!} />
              )}
              {(actress.metrics.fanScore ?? 0) > 0 && (
                <Stat label={t.fanScore} value={`${actress.metrics.fanScore}%`} />
              )}
            </div>
          )}

          {displayServices.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {displayServices.map((service) => {
                const meta = providerMeta[service as ProviderId];
                if (!meta) return null;
                const gradientStyle = meta.gradientColors
                  ? { background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})` }
                  : { backgroundColor: '#4b5563' };
                return (
                  <span
                    key={service}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={gradientStyle}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </article>

      {/* Product images lightbox */}
      <ImageLightbox images={productImages} isOpen={showLightbox} onClose={handleCloseLightbox} alt={actress['name']} />
    </>
  );
}

// Memoize to prevent re-renders in list views
export const ActressCardBase = memo(ActressCardBaseComponent);

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="theme-content theme-border rounded-xl border py-3">
      <div className="theme-text-muted text-xs">{label}</div>
      <div className="theme-text text-lg font-semibold">{value}</div>
    </div>
  );
}
