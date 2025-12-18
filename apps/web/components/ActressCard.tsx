'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Actress } from '@/types/product';
import { providerMeta } from '@/lib/providers';
import { normalizeImageUrl, isUncensoredThumbnail } from '@/lib/image-utils';
import FavoriteButton from './FavoriteButton';
import { ImageLightbox, getActressCardThemeConfig } from '@adult-v/shared/components';

// Theme configuration for apps/web (dark theme)
const themeConfig = getActressCardThemeConfig('dark');
const PLACEHOLDER_IMAGE = themeConfig.placeholderImage;

interface Props {
  actress: Actress;
  compact?: boolean;
  priority?: boolean;
}

export default function ActressCard({ actress, compact = false, priority = false }: Props) {
  const t = useTranslations('actressCard');
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';

  // 通常表示ではheroImage優先、コンパクト表示ではthumbnail優先
  const rawImageUrl = compact
    ? (actress.thumbnail || actress.heroImage)
    : (actress.heroImage || actress.thumbnail);
  const initialSrc = normalizeImageUrl(rawImageUrl);
  const [imgSrc, setImgSrc] = useState(initialSrc || PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(!initialSrc);

  // Lightbox表示用の状態
  const [showLightbox, setShowLightbox] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);

  // 無修正サイトのサムネイルかどうか判定（ブラー適用用）
  const shouldBlur = isUncensoredThumbnail(rawImageUrl);

  // Use services directly (no filtering for web app)
  const displayServices = actress.services || [];

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  // 画像クリックで出演作品をフェッチしてLightbox表示
  const handleImageClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(`/api/products?actressId=${actress.id}&limit=30`);
      if (response.ok) {
        const data = await response.json();
        const images = (data.products || [])
          .map((p: { imageUrl?: string | null }) => p.imageUrl)
          .filter((url: string | null | undefined): url is string => !!url)
          .map((url: string) => normalizeImageUrl(url))
          .filter((url: string | null): url is string => !!url);
        setProductImages(images);
        if (images.length > 0) {
          setShowLightbox(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [actress.id]);

  const handleCloseLightbox = useCallback(() => {
    setShowLightbox(false);
  }, []);

  if (compact) {
    // コンパクト表示: 画像クリックでモーダル、名前クリックで詳細ページへ
    return (
      <>
        <div className="theme-card theme-text rounded-lg overflow-hidden hover:shadow-xl transition-all duration-200">
          {/* 画像部分 - クリックでモーダル表示 */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleImageClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleImageClick(e as unknown as React.MouseEvent); }}
            className="relative aspect-[3/4] w-full block cursor-pointer group"
          >
            <Image
              src={imgSrc}
              alt={actress.name}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 16vw"
              className={`object-cover opacity-90 group-hover:scale-105 transition-transform duration-300 ${shouldBlur ? 'blur-md' : ''}`}
              loading={priority ? undefined : "lazy"}
              priority={priority}
              fetchPriority={priority ? "high" : "auto"}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              onError={handleImageError}
              unoptimized
            />
            {/* お気に入りボタン */}
            <div
              className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-white rounded-full shadow-md scale-90 sm:scale-100 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <FavoriteButton type="actress" id={actress.id} />
            </div>
            {/* ホバー時のオーバーレイ */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>

          {/* 名前と情報部分 - 画像外に配置 */}
          <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
            {/* 名前 - 詳細ページへのリンク */}
            <Link
              href={`/${locale}/actress/${actress.id}`}
              className={`block text-sm sm:text-base font-semibold truncate leading-tight ${themeConfig.hoverColor} transition-colors`}
            >
              {actress.name}
            </Link>
            {/* 別名表示（デスクトップのみ） */}
            {actress.aliases && actress.aliases.length > 0 && (
              <p className="hidden sm:block text-[10px] theme-text-muted truncate">
                ({actress.aliases.slice(0, 2).join(', ')}{actress.aliases.length > 2 ? ' ...' : ''})
              </p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted hidden sm:inline">{t('releaseCount')}</span>
              <span className="font-semibold">{actress.metrics?.releaseCount || 0}{t('videos')}</span>
            </div>
            {displayServices.length > 0 && (
              <div className="flex flex-wrap gap-0.5 sm:gap-1 min-h-[18px]">
                {displayServices.slice(0, 3).map((service) => {
                  const meta = providerMeta[service];
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

        {/* 出演作品Lightbox */}
        <ImageLightbox
          images={productImages}
          isOpen={showLightbox}
          onClose={handleCloseLightbox}
          alt={actress.name}
        />
      </>
    );
  }

  // 通常表示 - imgSrcを使用（エラー時にフォールバックが効く）
  return (
    <div className="theme-card theme-text rounded-2xl overflow-hidden">
      <div className="relative aspect-4/5">
        <Image
          src={imgSrc}
          alt={actress.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover opacity-90 ${shouldBlur ? 'blur-md' : ''}`}
          loading="lazy"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          onError={handleImageError}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute top-4 right-4 bg-white rounded-full shadow-md">
          <FavoriteButton type="actress" id={actress.id} />
        </div>
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-sm uppercase tracking-widest text-white/70">
            {actress.catchcopy}
          </p>
          <h3 className="text-3xl font-semibold">{actress.name}</h3>
          {/* 別名表示 */}
          {actress.aliases && actress.aliases.length > 0 && (
            <p className="text-sm text-white/60 mt-1">
              ({actress.aliases.slice(0, 3).join(', ')}{actress.aliases.length > 3 ? ' ...' : ''})
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* レビューを優先表示、なければdescription */}
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
            <Stat label={t('releaseCount')} value={`${actress.metrics.releaseCount || 0}${t('videos')}`} />
            <Stat label={t('trend')} value={actress.metrics.trendingScore || 0} />
            <Stat label={t('fanScore')} value={`${actress.metrics.fanScore || 0}%`} />
          </div>
        )}

        {displayServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {displayServices.map((service) => {
              const meta = providerMeta[service];
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
