'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo, useEffect, memo, type ReactNode, type ComponentType } from 'react';
import { usePathname, useSearchParams, useParams } from 'next/navigation';
import type { Product } from '../../types';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '../../lib/image-utils';
import { generateAltText } from '../../lib/seo-utils';
import { getThemeConfig, type ProductCardTheme } from './themes';
import { getAffiliateUrl, type GetAffiliateUrlOptions } from './helpers';
import { CopyButton } from '../CopyButton';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

// Default translations (Japanese) for ProductCard
const DEFAULT_TRANSLATIONS: Record<string, string> = {
  viewSale: 'セールを見る',
  viewDetails: '詳細を見る',
  playSampleVideo: 'サンプル動画を再生',
  close: '閉じる',
  videoNotSupported: 'お使いのブラウザは動画をサポートしていません',
  enlargeImage: '画像を拡大',
  comingSoon: '近日発売',
  monthly: '月額',
  urgentLastHour: '残り1時間',
  urgentEndsIn: '残り{hours}時間',
  urgentEndsSoon: '残り{hours}時間',
  saleTomorrow: '明日まで',
  saleEndsIn: '残り{days}日',
  performerInfo: '出演者情報',
  releaseDateTbd: '発売日未定',
  subscriptionOnly: '月額見放題',
};

// Safe hook that tries to use next-intl but falls back gracefully
function useSafeProductCardTranslations(): (key: string, params?: Record<string, string | number>) => string {
  try {
    // Try to import and use next-intl
    const { useTranslations } = require('next-intl');
    const t = useTranslations('productCard');
    return (key: string, params?: Record<string, string | number>) => {
      try {
        return t(key, params);
      } catch {
        // Translation key not found, use fallback
        let fallback = DEFAULT_TRANSLATIONS[key] || key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            fallback = fallback.replace(`{${k}}`, String(v));
          });
        }
        return fallback;
      }
    };
  } catch {
    // next-intl context not available, use fallback
    return (key: string, params?: Record<string, string | number>) => {
      let fallback = DEFAULT_TRANSLATIONS[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          fallback = fallback.replace(`{${k}}`, String(v));
        });
      }
      return fallback;
    };
  }
}

// Blur placeholder for images
const BLUR_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

export type ProductCardSize = 'full' | 'compact' | 'mini';

export interface ProductCardBaseProps {
  product: Product;
  /** Theme: 'dark' for adult-v, 'light' for fanza. Falls back to SiteThemeContext if omitted. */
  theme?: ProductCardTheme;
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
  trackCtaClick?: (
    testName: string,
    productId: string | number,
    params?: Record<string, string | number | boolean>,
  ) => void;
  /** Affiliate URL options */
  affiliateUrlOptions?: GetAffiliateUrlOptions;
  /** Whether to hide FANZA purchase links (for adult-v site) */
  hideFanzaPurchaseLinks?: boolean;
  /** Priority loading for LCP optimization (first few cards) */
  priority?: boolean;
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
  priority = false,
}: ProductCardBaseProps) {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = useSafeProductCardTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteTheme = useSiteTheme();
  const resolvedTheme: ProductCardTheme = theme ?? siteTheme.theme;
  const themeConfig = getThemeConfig(resolvedTheme);

  // Resolve size from either new size prop or deprecated compact prop
  const resolvedSize: ProductCardSize = size ?? (compact ? 'compact' : 'full');

  // Use default placeholder based on theme if not provided
  const resolvedPlaceholder =
    placeholderImage ?? (resolvedTheme === 'dark' ? DEFAULT_PLACEHOLDER_DARK : DEFAULT_PLACEHOLDER_LIGHT);

  // Default formatPrice if not provided - memoize fallback
  const resolvedFormatPrice = useMemo(
    () =>
      formatPrice ??
      ((price: number, currency?: string) =>
        currency === 'USD' ? `$${price.toLocaleString()}` : `¥${price.toLocaleString()}`),
    [formatPrice],
  );

  // Hydration state - ABテストのバリアントはHydration後にのみ適用
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Default getVariant if not provided - memoize fallback
  // Hydration前はデフォルト値を返すことで、サーバー/クライアント間の不整合を防止
  const resolvedGetVariant = useMemo(() => {
    if (!isHydrated) {
      // SSR/Hydration中はデフォルト値を返す
      return () => 'default';
    }
    return getVariant ?? (() => 'default');
  }, [getVariant, isHydrated]);

  // Default trackCtaClick if not provided - memoize fallback
  const resolvedTrackCtaClick = useMemo(() => trackCtaClick ?? (() => {}), [trackCtaClick]);

  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : resolvedPlaceholder);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const hasSampleVideo = product.sampleVideos && product.sampleVideos.length > 0;
  const primaryVideo = hasSampleVideo ? (product.sampleVideos?.[0] ?? null) : null;

  const allImages = useMemo(() => {
    const imageSet = new Set<string>();
    const images: string[] = [];

    if (hasValidImageUrl && product.imageUrl) {
      const normalized = normalizeImageUrl(product.imageUrl);
      const fullSize = getFullSizeImageUrl(normalized);
      imageSet.add(fullSize);
      images.push(fullSize);
    }

    // sampleImagesは最大20枚に制限（パフォーマンス最適化）
    const sampleImages = product.sampleImages?.slice(0, 20) || [];
    for (const img of sampleImages) {
      const normalized = normalizeImageUrl(img);
      const fullSize = getFullSizeImageUrl(normalized);
      if (!imageSet.has(fullSize)) {
        imageSet.add(fullSize);
        images.push(fullSize);
      }
    }

    return images;
  }, [product.imageUrl, product.sampleImages, hasValidImageUrl]);

  // SEO最適化されたalt属性を生成
  const altText = useMemo(() => generateAltText(product), [product]);

  const isActressPage = pathname.includes('/actress/');

  const getTagFilterUrl = useCallback(
    (tag: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const existingInclude = params.get('include');
      if (existingInclude) {
        const existingTags = existingInclude.split(',').map((t) => t.trim());
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
    },
    [isActressPage, pathname, searchParams, locale],
  );

  const handleImageError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(resolvedPlaceholder);
    }
  }, [hasError, resolvedPlaceholder]);

  const isUncensored = isDtiUncensoredSite(imgSrc);

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (imgSrc !== resolvedPlaceholder && hasValidImageUrl && !hasError) {
        setShowModal(true);
      }
    },
    [imgSrc, hasValidImageUrl, hasError, resolvedPlaceholder],
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalImageIndex(0);
  }, []);

  const handleVideoClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasSampleVideo) {
        setShowVideoModal(true);
      }
    },
    [hasSampleVideo],
  );

  const handleCloseVideoModal = useCallback(() => {
    setShowVideoModal(false);
  }, []);

  // セール終了日の計算（Hydrationエラー回避のため、クライアントサイドでのみ計算）
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    // クライアントサイドでのみ現在時刻を設定
    setClientNow(new Date());
  }, []);

  const saleUrgencyInfo = useMemo(() => {
    if (!product.salePrice || !product.saleEndAt) {
      return {
        diffHours: 0,
        diffDays: 0,
        isVeryUrgent: false,
        isUrgent: false,
        showBadge: false,
        showCountdown: false,
      };
    }
    // Hydration対策: サーバーサイドではセール緊急表示を無効化
    if (!clientNow) {
      return {
        diffHours: 0,
        diffDays: 0,
        isVeryUrgent: false,
        isUrgent: false,
        showBadge: false,
        showCountdown: false,
      };
    }
    const endDate = new Date(product.saleEndAt);
    const diffMs = endDate.getTime() - clientNow.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isVeryUrgent = diffHours > 0 && diffHours <= 6;
    const isUrgent = diffHours > 0 && diffHours <= 24;
    const showBadge = diffHours > 0 && diffHours <= 48;
    const showCountdown = diffDays > 0 && diffDays <= 3;

    return { diffHours, diffDays, isVeryUrgent, isUrgent, showBadge, showCountdown };
  }, [product.salePrice, product.saleEndAt, clientNow]);

  // CTA click handler - memoized to avoid recreation on each render
  const handleCtaClick = useCallback(() => {
    resolvedTrackCtaClick('ctaButtonText', product['id'], {
      is_sale: !!product.salePrice,
      provider: product.provider || '',
    });
  }, [resolvedTrackCtaClick, product['id'], product.salePrice, product.provider]);

  // Mini size - simplest card for WeeklyHighlights, etc.
  if (resolvedSize === 'mini') {
    const miniAffiliateUrl = getAffiliateUrl(product['affiliateUrl'], affiliateUrlOptions);
    const showMiniCta = miniAffiliateUrl && !(hideFanzaPurchaseLinks && product.provider === 'fanza');

    return (
      <div
        className={`group relative ${resolvedTheme === 'dark' ? 'bg-white/3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'bg-white'} overflow-hidden rounded-xl border ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-gray-200'} transition-all duration-200 hover:shadow-lg hover:ring-1 ${resolvedTheme === 'dark' ? 'hover:bg-white/5 hover:ring-fuchsia-400/20' : 'hover:ring-gray-300'}`}
      >
        <Link href={`/${locale}/products/${product['id']}`}>
          <div
            className={`relative ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            style={{ aspectRatio: '2/3' }}
          >
            {hasValidImageUrl ? (
              <Image
                src={imgSrc}
                alt={altText}
                fill
                sizes="(max-width: 640px) 15vw, (max-width: 1024px) 10vw, 6vw"
                className={`object-cover transition-transform duration-200 group-hover:scale-[1.02] ${isUncensored ? 'blur-[1px]' : ''}`}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                loading={priority ? 'eager' : 'lazy'}
                priority={priority}
                fetchPriority={priority ? 'high' : 'low'}
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
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
              </div>
            )}
            {product['rating'] && product['rating'] > 0 && (
              <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">
                <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {product['rating'].toFixed(1)}
              </div>
            )}
            {/* ホバー時CTA オーバーレイ */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold text-white shadow-lg ${
                  showMiniCta
                    ? product.salePrice
                      ? 'bg-linear-to-r from-red-600 to-orange-500'
                      : 'bg-linear-to-r from-fuchsia-600 to-purple-500'
                    : resolvedTheme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-gray-600'
                }`}
              >
                {showMiniCta ? (product.salePrice ? t('viewSale') : t('viewDetails')) : t('viewDetails')}
              </span>
            </div>
          </div>
          <div className="p-2">
            <p
              className={`${resolvedTheme === 'dark' ? 'text-gray-200 group-hover:text-fuchsia-300' : 'text-gray-800 group-hover:text-pink-600'} line-clamp-2 text-xs leading-snug font-medium transition-colors`}
            >
              {product['title']}
            </p>
            <span
              className={`mt-0.5 block text-[9px] ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'} truncate`}
            >
              {product.normalizedProductId || product['id']}
            </span>
          </div>
        </Link>
        {/* 購入CTA（miniモード）- 常時表示でクリック率向上 */}
        {showMiniCta ? (
          <a
            href={miniAffiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={(e) => {
              e.stopPropagation();
              resolvedTrackCtaClick('ctaButtonText', product['id'], {
                is_sale: !!product.salePrice,
                provider: product.provider || '',
                card_size: 'mini',
              });
            }}
            className={`absolute right-0 bottom-0 left-0 py-1.5 text-center text-[10px] font-bold text-white transition-colors duration-200 ${
              product.salePrice
                ? 'bg-linear-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400'
                : resolvedTheme === 'dark'
                  ? 'bg-linear-to-r from-fuchsia-600 to-purple-500 hover:from-fuchsia-500 hover:to-purple-400'
                  : 'bg-linear-to-r from-pink-500 to-rose-400 hover:from-pink-400 hover:to-rose-300'
            }`}
          >
            {product.salePrice ? `${product['discount'] || ''}%OFF ` : ''}
            {product.providerLabel} →
          </a>
        ) : (
          <Link
            href={`/${locale}/products/${product['id']}`}
            className={`absolute right-0 bottom-0 left-0 py-1.5 text-center text-[10px] font-bold transition-colors duration-200 ${
              resolvedTheme === 'dark'
                ? 'bg-gray-800/90 text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'bg-gray-100/90 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            {t('viewDetails')} →
          </Link>
        )}
      </div>
    );
  }

  // Compact mode
  if (resolvedSize === 'compact') {
    const compactAffiliateUrl = getAffiliateUrl(product['affiliateUrl'], affiliateUrlOptions);
    const showCompactCta = compactAffiliateUrl && !(hideFanzaPurchaseLinks && product.provider === 'fanza');

    return (
      <>
        <div
          className={`relative block ${themeConfig.cardBg} overflow-hidden rounded-xl border ${themeConfig.cardBorder} hover:ring-1 ${themeConfig.cardHoverRing} group shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:shadow-lg ${resolvedTheme === 'dark' ? 'hover:bg-white/5 hover:shadow-fuchsia-500/10' : 'hover:shadow-pink-500/10'}`}
        >
          <Link href={`/${locale}/products/${product['id']}`}>
            <div className={`relative bg-linear-to-br ${themeConfig.gradient}`} style={{ aspectRatio: '2/3' }}>
              <Image
                src={imgSrc}
                alt={altText}
                fill
                className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[1px]' : ''}`}
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 10vw"
                loading={priority ? 'eager' : 'lazy'}
                priority={priority}
                fetchPriority={priority ? 'high' : 'low'}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                onError={handleImageError}
                quality={75}
              />
              {product.salePrice && (
                <div className="absolute top-1 left-1 z-10 flex gap-1">
                  <span className="flex items-center gap-0.5 rounded-md bg-linear-to-r from-red-600 to-orange-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    SALE
                  </span>
                  {product['discount'] && product['discount'] >= 30 && (
                    <span className="rounded-md bg-linear-to-r from-yellow-400 to-orange-500 px-2 py-1 text-[10px] font-bold text-black shadow-lg">
                      {product['discount']}%OFF
                    </span>
                  )}
                </div>
              )}
              {/* 高評価バッジ */}
              {product['rating'] && product['rating'] >= 4.5 && (
                <div className="absolute right-1 bottom-1 z-10 flex items-center gap-0.5 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {product['rating'].toFixed(1)}
                </div>
              )}
            </div>
            <div className="p-2">
              <p
                className={`text-xs font-medium ${themeConfig.textPrimary} line-clamp-2 leading-snug transition-colors ${resolvedTheme === 'dark' ? 'group-hover:text-fuchsia-300' : 'group-hover:text-pink-600'}`}
              >
                {product['title']}
              </p>
              {/* 品番 + コピーボタン */}
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-[10px] ${themeConfig.textMuted} truncate`}>
                  {product.normalizedProductId || product['id']}
                </span>
                <CopyButton
                  text={product.normalizedProductId || String(product['id'])}
                  iconOnly
                  size="xs"
                  className={
                    resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800' : ''
                  }
                />
              </div>
              {/* 価格表示（compactモード） */}
              {(product.salePrice || product['price'] > 0) && (
                <div className="mt-1 flex items-center gap-1">
                  {product.salePrice ? (
                    <>
                      <span className={`text-[11px] font-bold ${themeConfig.salePriceColor}`}>
                        {resolvedFormatPrice(product.salePrice, product.currency)}
                      </span>
                      {product['price'] > 0 && (
                        <span className={`text-[10px] ${themeConfig.textMuted} line-through`}>
                          {resolvedFormatPrice(product['price'], product.currency)}
                        </span>
                      )}
                      {product['discount'] && product['discount'] >= 20 && (
                        <span className="rounded bg-red-600/80 px-1 py-px text-[9px] font-bold text-white">
                          -{product['discount']}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={`text-[11px] font-medium ${themeConfig.textSecondary}`}>
                      {resolvedFormatPrice(product['price'], product.currency)}
                    </span>
                  )}
                </div>
              )}
              {/* 女優名リンク（導線強化） */}
              {product.performers && product.performers.length > 0 && product.performers[0] && (
                <div className="mt-1 truncate">
                  <Link
                    href={`/${locale}/actress/${product.performers[0]['id']}`}
                    className={`text-[10px] ${themeConfig.accentColor} font-medium hover:underline`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {product.performers[0]['name']}
                  </Link>
                </div>
              )}
            </div>
          </Link>

          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-0 left-0 z-20 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-br-lg bg-black/70 text-white transition-all hover:scale-105 hover:bg-black/90"
              style={{ marginLeft: product.salePrice ? '40px' : '0' }}
              aria-label={t('playSampleVideo')}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {(FavoriteButton || ViewedButton) && (
            <div className="absolute top-1 right-1 z-20 flex gap-0.5">
              {FavoriteButton && <FavoriteButton type="product" id={product['id']} size="xs" />}
              {ViewedButton && (
                <ViewedButton
                  productId={String(product['id'])}
                  title={product['title']}
                  imageUrl={product.imageUrl ?? null}
                  aspName={product.providerLabel ?? product.provider ?? 'unknown'}
                  {...(product.actressName
                    ? { performerName: product.actressName }
                    : product.performers?.[0]?.name
                      ? { performerName: product.performers[0].name }
                      : {})}
                  {...(product.actressId
                    ? { performerId: product.actressId }
                    : product.performers?.[0]?.id
                      ? { performerId: product.performers[0].id }
                      : {})}
                  {...(product.tags ? { tags: product.tags } : {})}
                  {...(product['duration'] !== undefined ? { duration: product['duration'] } : {})}
                  size="xs"
                  iconOnly
                />
              )}
            </div>
          )}

          {/* 購入CTA（compactモード）- 常時表示でクリック率向上 */}
          {showCompactCta ? (
            <a
              href={compactAffiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => {
                e.stopPropagation();
                resolvedTrackCtaClick('ctaButtonText', product['id'], {
                  is_sale: !!product.salePrice,
                  provider: product.provider || '',
                  card_size: 'compact',
                });
              }}
              className={`absolute right-0 bottom-0 left-0 z-30 py-2 text-center text-[11px] font-bold text-white shadow-[0_-2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 ${
                product.salePrice
                  ? 'bg-linear-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400'
                  : resolvedTheme === 'dark'
                    ? 'bg-linear-to-r from-fuchsia-600 to-purple-500 hover:from-fuchsia-500 hover:to-purple-400'
                    : 'bg-linear-to-r from-pink-500 to-rose-400 hover:from-pink-400 hover:to-rose-300'
              }`}
            >
              {product.salePrice ? `${product['discount'] || ''}%OFF ` : ''}
              {product.providerLabel}で見る →
            </a>
          ) : (
            <Link
              href={`/${locale}/products/${product['id']}`}
              className={`absolute right-0 bottom-0 left-0 z-30 py-2 text-center text-[11px] font-bold shadow-[0_-2px_8px_rgba(0,0,0,0.2)] transition-all duration-200 ${
                resolvedTheme === 'dark'
                  ? 'bg-gray-800/90 text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'bg-gray-100/90 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {t('viewDetails')} →
            </Link>
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
              className="absolute top-4 right-4 z-50 text-white hover:text-gray-300"
              aria-label={t('close')}
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative mx-4 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
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
    <article
      className={`group/card ${themeConfig.cardBg} flex flex-col overflow-hidden rounded-xl border shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:shadow-lg ${resolvedTheme === 'dark' ? 'hover:bg-white/5' : ''} ${themeConfig.cardBorder}`}
    >
      <div className={`relative bg-linear-to-br ${themeConfig.gradient}`} style={{ height: '18rem' }}>
        <div className="group relative block h-full">
          {/* Action buttons - positioned at top right of image container */}
          {(FavoriteButton || ViewedButton) && (
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
              {FavoriteButton && (
                <div className={`${themeConfig.favoriteButtonBg} rounded-full shadow-md`}>
                  <FavoriteButton type="product" id={product['id']} />
                </div>
              )}
              {ViewedButton && (
                <ViewedButton
                  productId={String(product['id'])}
                  title={product['title']}
                  imageUrl={product.imageUrl ?? null}
                  aspName={product.providerLabel ?? product.provider ?? 'unknown'}
                  {...(product.actressName
                    ? { performerName: product.actressName }
                    : product.performers?.[0]?.name
                      ? { performerName: product.performers[0].name }
                      : {})}
                  {...(product.actressId
                    ? { performerId: product.actressId }
                    : product.performers?.[0]?.id
                      ? { performerId: product.performers[0].id }
                      : {})}
                  {...(product.tags ? { tags: product.tags } : {})}
                  {...(product['duration'] !== undefined ? { duration: product['duration'] } : {})}
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
            alt={altText}
            fill
            className={`object-cover transition-transform duration-200 group-hover:scale-[1.02] ${isUncensored ? 'blur-[1px]' : ''}`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading={priority ? 'eager' : 'lazy'}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            onError={handleImageError}
            priority={priority}
            fetchPriority={priority ? 'high' : 'low'}
            quality={75}
          />
          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-0 left-0 z-20 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-br-xl bg-black/70 text-white transition-all hover:scale-105 hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={t('playSampleVideo')}
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {hasValidImageUrl && !hasError && imgSrc !== resolvedPlaceholder && (
            <div className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          )}
          {/* サンプルコンテンツ数バッジ */}
          {((product.sampleImages?.length ?? 0) > 0 || (product.sampleVideos?.length ?? 0) > 0) && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {product.sampleImages && product.sampleImages.length > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {product.sampleImages.length}
                </span>
              )}
              {product.sampleVideos && product.sampleVideos.length > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-fuchsia-600/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {product.sampleVideos.length}
                </span>
              )}
            </div>
          )}
          {(hasError || imgSrc === resolvedPlaceholder || !hasValidImageUrl) && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br ${themeConfig.noImageGradient}`}
            >
              <div className={`mb-3 text-7xl ${themeConfig.noImageEmoji}`}>📷</div>
              <span
                className={`inline-block px-4 py-1.5 ${themeConfig.noImageBadgeBg} ${themeConfig.noImageBadgeText} rounded-full text-xs font-bold shadow-md`}
              >
                NO IMAGE
              </span>
            </div>
          )}
        </div>
        {product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
              {t('comingSoon')}
            </span>
          </div>
        )}
        {product.isNew && !product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg">NEW</span>
          </div>
        )}
        {/* Urgency badge for sales ending within 48 hours */}
        {saleUrgencyInfo.showBadge && (
          <div className="absolute top-4 right-4 z-20">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold shadow-lg ${
                saleUrgencyInfo.isVeryUrgent
                  ? 'animate-pulse bg-red-600 text-white'
                  : saleUrgencyInfo.isUrgent
                    ? `${themeConfig.urgencyBadgeBg} ${themeConfig.urgencyBadgeText} animate-pulse`
                    : 'bg-yellow-500 text-black'
              }`}
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {saleUrgencyInfo.diffHours <= 1
                ? t('urgentLastHour')
                : saleUrgencyInfo.diffHours <= 24
                  ? t('urgentEndsIn', { hours: saleUrgencyInfo.diffHours })
                  : t('urgentEndsSoon', { hours: saleUrgencyInfo.diffHours })}
            </span>
          </div>
        )}
        {product.productType === 'dvd' && (
          <div
            className="absolute top-4 left-4"
            style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}
          >
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
              DVD
            </span>
          </div>
        )}
        {product.productType === 'monthly' && (
          <div
            className="absolute top-4 left-4"
            style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}
          >
            <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
              {t('monthly')}
            </span>
          </div>
        )}
        {rankPosition && rankPosition <= 10 && (
          <div className="absolute top-14 right-4 z-20">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ${
                rankPosition === 1
                  ? 'bg-linear-to-r from-yellow-400 to-amber-500 text-black'
                  : rankPosition === 2
                    ? 'bg-linear-to-r from-gray-300 to-gray-400 text-black'
                    : rankPosition === 3
                      ? 'bg-linear-to-r from-amber-600 to-amber-700 text-white'
                      : `${themeConfig.rankingDefaultBg} ${themeConfig.rankingDefaultText} border ${themeConfig.rankingDefaultBorder}`
              }`}
            >
              {rankPosition <= 3 ? `🏆 ${rankPosition}位` : `${rankPosition}位`}
            </span>
          </div>
        )}
        {product['discount'] && !product.salePrice && (
          <span
            className={`absolute right-4 bottom-4 ${themeConfig.badgeBg} rounded-full px-3 py-1 text-xs font-bold text-white`}
          >
            {product['discount']}%OFF
          </span>
        )}
        {(product.salePrice || product['price'] > 0) &&
          (() => {
            const priceVariant = resolvedGetVariant('priceDisplayStyle');
            const isEmphasized = priceVariant === 'emphasized';
            const countdownVariant = resolvedGetVariant('saleCountdownStyle');
            const isAnimated = countdownVariant === 'animated';

            return (
              <div
                className={`absolute bottom-4 left-4 ${themeConfig.priceBadgeBg} rounded-lg border px-2.5 py-1.5 shadow-lg backdrop-blur-sm ${themeConfig.priceBadgeBorder}`}
              >
                {product.salePrice ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-bold ${themeConfig.salePriceColor} ${isEmphasized ? 'text-base' : 'text-sm'}`}
                      >
                        {resolvedFormatPrice(product.salePrice, product.currency)}
                      </span>
                      {product['discount'] && (
                        <span
                          className={`font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} rounded px-1 py-0.5 ${isEmphasized ? 'text-xs' : 'text-[10px]'}`}
                        >
                          -{product['discount']}%
                        </span>
                      )}
                    </div>
                    {saleUrgencyInfo.showCountdown && (
                      <span
                        className={`text-[10px] font-bold ${themeConfig.countdownColor} ${isAnimated ? 'animate-pulse' : ''}`}
                      >
                        {saleUrgencyInfo.diffDays === 1
                          ? '⏰ ' + t('saleTomorrow')
                          : `⏰ ${t('saleEndsIn', { days: saleUrgencyInfo.diffDays })}`}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className={`font-bold ${themeConfig.regularPriceColor} ${isEmphasized ? 'text-base' : 'text-sm'}`}
                  >
                    {resolvedFormatPrice(product['price'], product.currency)}
                  </span>
                )}
              </div>
            );
          })()}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <div>
          <div className={`text-[10px] sm:text-xs ${themeConfig.textSecondary} flex items-center gap-1 truncate`}>
            {product.actressId ? (
              <Link
                href={`/${locale}/actress/${product.actressId}`}
                className={`inline-flex items-center gap-0.5 ${themeConfig.accentColor} ${themeConfig.accentHover} truncate font-medium underline-offset-2 transition-colors hover:underline`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="truncate">{product.actressName ?? t('performerInfo')}</span>
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {product.performers.slice(0, 2).map((performer, index) => (
                  <span key={performer['id']}>
                    <Link
                      href={`/${locale}/actress/${performer['id']}`}
                      className={`${themeConfig.accentColor} ${themeConfig.accentHover} font-medium underline-offset-2 transition-colors hover:underline`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {performer['name']}
                    </Link>
                    {index < Math.min(product.performers!.length, 2) - 1 && (
                      <span className={`mx-0.5 ${themeConfig.separatorColor}`}>/</span>
                    )}
                  </span>
                ))}
              </span>
            ) : (
              <span className={`${themeConfig.textMuted} truncate`}>{product.actressName ?? t('performerInfo')}</span>
            )}
            <span className={`${themeConfig.separatorColor} shrink-0`}>|</span>
            <span className={`${themeConfig.textMuted} shrink-0`}>{product['releaseDate'] ?? t('releaseDateTbd')}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Link href={`/${locale}/products/${product['id']}`}>
              <p className={`text-[10px] sm:text-xs ${themeConfig.textMuted} truncate`}>
                {product.normalizedProductId || product['id']}
              </p>
            </Link>
            <span className="opacity-0 transition-opacity group-hover/card:opacity-100">
              <CopyButton
                text={product.normalizedProductId || String(product['id'])}
                iconOnly
                size="xs"
                className={
                  resolvedTheme === 'light' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800' : ''
                }
              />
            </span>
          </div>
          <Link href={`/${locale}/products/${product['id']}`}>
            <p
              className={`mt-0.5 line-clamp-2 text-sm leading-tight font-semibold sm:text-base ${themeConfig.textPrimary} hover:opacity-80`}
            >
              {product['title']}
            </p>
          </Link>
        </div>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={getTagFilterUrl(tag)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs ${themeConfig.tagBg} ${themeConfig.tagText} ${themeConfig.tagHoverBg} ${themeConfig.tagHoverText} transition-colors`}
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {(product['rating'] || product['duration']) && (
          <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs ${themeConfig.textSecondary}`}>
            {product['rating'] != null && StarRating && (
              <StarRating
                rating={product['rating'] as number}
                {...(product['reviewCount'] !== undefined ? { reviewCount: product['reviewCount'] } : {})}
                size="sm"
                showCount={true}
              />
            )}
            {product['duration'] && <span className="shrink-0">・{product['duration']}分</span>}
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          {product.salePrice && product.regularPrice ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <p className={`text-base font-semibold sm:text-lg ${themeConfig.salePriceColor}`}>
                  {resolvedFormatPrice(product.salePrice, product.currency)}
                </p>
                <p className={`text-[10px] sm:text-xs ${themeConfig.textMuted} line-through`}>
                  {resolvedFormatPrice(product.regularPrice, product.currency)}
                </p>
                {product['discount'] && (
                  <span
                    className={`text-[10px] font-bold ${themeConfig.discountBadgeText} ${themeConfig.discountBadgeBg} rounded px-1 py-0.5`}
                  >
                    -{product['discount']}%
                  </span>
                )}
              </div>
              {/* 節約額の表示 */}
              {product.regularPrice && product.salePrice && product.regularPrice > product.salePrice && (
                <p className={`text-[10px] font-bold ${themeConfig.salePriceColor} flex items-center gap-0.5`}>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ¥{(product.regularPrice - product.salePrice).toLocaleString()}お得
                </p>
              )}
            </div>
          ) : product['price'] > 0 ? (
            <p className={`text-base font-semibold sm:text-lg ${themeConfig.regularPriceColor}`}>
              {resolvedFormatPrice(product['price'], product.currency)}
            </p>
          ) : product.provider && isSubscriptionSite(product.provider) ? (
            <p className={`text-sm font-semibold ${themeConfig.subscriptionColor}`}>{t('subscriptionOnly')}</p>
          ) : null}

          {(() => {
            const affiliateUrl = getAffiliateUrl(product['affiliateUrl'], affiliateUrlOptions);
            const isFanzaHidden = hideFanzaPurchaseLinks && product.provider === 'fanza';

            if (!affiliateUrl || isFanzaHidden) {
              // Fallback: detail page CTA when affiliate link unavailable or hidden
              return (
                <Link
                  href={`/${locale}/products/${product['id']}`}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${
                    resolvedTheme === 'dark'
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{t('viewDetails')} →</span>
                </Link>
              );
            }

            const isSale = !!product.salePrice;

            const ctaVariant = resolvedGetVariant('ctaButtonText');
            const getCtaText = () => {
              const provider = product.providerLabel;
              if (isSale) {
                switch (ctaVariant) {
                  case 'urgency':
                    return `${provider}で今すぐ購入`;
                  case 'action':
                    return `${provider}でお得にゲット`;
                  default:
                    return `${provider}でお得に購入`;
                }
              } else {
                switch (ctaVariant) {
                  case 'urgency':
                    return `${provider}で今すぐ見る`;
                  case 'action':
                    return `${provider}をチェック`;
                  default:
                    return `${provider}で見る`;
                }
              }
            };

            return (
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={handleCtaClick}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${
                  isSale
                    ? `bg-linear-to-r ${themeConfig.ctaSaleGradient} text-white ${themeConfig.ctaSaleGradientHover} shadow-lg shadow-red-500/25 hover:shadow-red-500/40`
                    : `bg-linear-to-r ${themeConfig.ctaGradient} text-white ${themeConfig.ctaGradientHover} shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40`
                }`}
                title={`${product.providerLabel}で購入`}
                aria-label={`${product.providerLabel}で購入（外部リンク）`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="truncate">{getCtaText()}</span>
              </a>
            );
          })()}

          {/* 他のASPで購入オプション - 最大2社をインライン表示 */}
          {product.alternativeSources && product.alternativeSources.length > 0 && (
            <div className="mt-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {product.alternativeSources.slice(0, 2).map((source, idx) => {
                  const isFanza = source.aspName.toUpperCase() === 'FANZA';
                  // FANZA compliance: hide external FANZA links when hideFanzaPurchaseLinks is true
                  if (isFanza && hideFanzaPurchaseLinks) return null;
                  const href = isFanza ? source.affiliateUrl : `/${locale}/products/${source.productId}`;
                  return (
                    <a
                      key={idx}
                      href={href}
                      {...(isFanza ? { target: '_blank', rel: 'noopener noreferrer sponsored' } : {})}
                      className={`rounded px-2 py-0.5 text-[10px] ${themeConfig.tagBg} ${themeConfig.tagText} flex items-center gap-1 transition-opacity hover:opacity-80`}
                    >
                      <span className="font-medium">{source.aspName}</span>
                      <span>{resolvedFormatPrice(source.salePrice || source.price)}</span>
                    </a>
                  );
                })}
                {product.alternativeSources.length > 2 && (
                  <div className="relative">
                    <details className="group">
                      <summary
                        className={`text-[10px] ${themeConfig.textMuted} cursor-pointer list-none rounded px-1.5 py-0.5 transition-colors hover:text-gray-400 [&::-webkit-details-marker]:hidden ${themeConfig.tagBg}`}
                      >
                        +{product.alternativeSources.length - 2}社
                      </summary>
                      <div
                        className={`absolute bottom-full left-1/2 z-50 mb-1 w-max max-w-[90vw] -translate-x-1/2 rounded-lg p-2 shadow-lg ${resolvedTheme === 'dark' ? 'border border-gray-700 bg-gray-800' : 'border border-gray-200 bg-white'}`}
                      >
                        <div className="flex flex-wrap gap-1">
                          {product.alternativeSources.slice(2).map((source, idx) => {
                            const isFanza = source.aspName.toUpperCase() === 'FANZA';
                            if (isFanza && hideFanzaPurchaseLinks) return null;
                            const href = isFanza ? source.affiliateUrl : `/${locale}/products/${source.productId}`;
                            return (
                              <a
                                key={idx}
                                href={href}
                                {...(isFanza ? { target: '_blank', rel: 'noopener noreferrer sponsored' } : {})}
                                className={`rounded px-2 py-1 text-[10px] ${themeConfig.tagBg} ${themeConfig.tagText} flex items-center gap-1 transition-opacity hover:opacity-80`}
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
          )}
        </div>
      </div>

      {ImageLightbox && (
        <ImageLightbox
          images={allImages}
          initialIndex={modalImageIndex}
          isOpen={showModal}
          onClose={handleCloseModal}
          alt={altText}
          detailsUrl={`/${locale}/products/${product['id']}`}
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
            className="absolute top-4 right-4 z-50 text-white hover:text-gray-300"
            aria-label={t('close')}
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative mx-4 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <video src={primaryVideo.url} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: '80vh' }}>
              {t('videoNotSupported')}
            </video>
          </div>
        </div>
      )}
    </article>
  );
}

export default memo(ProductCardBase, (prevProps, nextProps) => {
  return (
    prevProps.product['id'] === nextProps.product['id'] &&
    prevProps.product.salePrice === nextProps.product.salePrice &&
    prevProps.product['price'] === nextProps.product['price'] &&
    prevProps.rankPosition === nextProps.rankPosition &&
    prevProps.compact === nextProps.compact &&
    prevProps.size === nextProps.size &&
    prevProps.theme === nextProps.theme &&
    prevProps.placeholderImage === nextProps.placeholderImage &&
    prevProps.hideFanzaPurchaseLinks === nextProps.hideFanzaPurchaseLinks
  );
});
