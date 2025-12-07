'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Actress } from '@/types/product';
import { providerMeta } from '@/lib/providers';
import { normalizeImageUrl, isUncensoredThumbnail } from '@/lib/image-utils';
import FavoriteButton from './FavoriteButton';

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

interface Props {
  actress: Actress;
  compact?: boolean;
  priority?: boolean;
}

export default function ActressCard({ actress, compact = false, priority = false }: Props) {
  const t = useTranslations('actressCard');
  // 通常表示ではheroImage優先、コンパクト表示ではthumbnail優先
  const rawImageUrl = compact
    ? (actress.thumbnail || actress.heroImage)
    : (actress.heroImage || actress.thumbnail);
  const initialSrc = normalizeImageUrl(rawImageUrl);
  const [imgSrc, setImgSrc] = useState(initialSrc || PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(!initialSrc);

  // 無修正サイトのサムネイルかどうか判定（ブラー適用用）
  const shouldBlur = isUncensoredThumbnail(rawImageUrl);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  if (compact) {
    // コンパクト表示: 名前と基本情報のみ（モバイル最適化）
    return (
      <div className="bg-gray-900 text-white rounded-lg overflow-hidden shadow-lg ring-1 ring-white/10 hover:ring-white/20 transition-all active:ring-rose-500/50">
        <div className="relative aspect-[3/4]">
          <Image
            src={imgSrc}
            alt={actress.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 16vw"
            className={`object-cover opacity-90 ${shouldBlur ? 'blur-md' : ''}`}
            loading={priority ? undefined : "lazy"}
            priority={priority}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
          {/* お気に入りボタン - モバイルでは小さく */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-white rounded-full shadow-md scale-90 sm:scale-100">
            <FavoriteButton type="actress" id={actress.id} />
          </div>
          <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2 sm:left-2 sm:right-2">
            <h3 className="text-sm sm:text-base font-semibold truncate leading-tight">{actress.name}</h3>
            {/* 別名表示（デスクトップのみ） */}
            {actress.aliases && actress.aliases.length > 0 && (
              <p className="hidden sm:block text-[10px] text-gray-400 truncate">
                ({actress.aliases.slice(0, 2).join(', ')}{actress.aliases.length > 2 ? ' ...' : ''})
              </p>
            )}
            {/* AIレビューキーワード or キャッチコピー（デスクトップのみ） */}
            {actress.aiReview?.keywords && actress.aiReview.keywords.length > 0 ? (
              <p className="hidden sm:block text-[10px] text-purple-300 truncate">
                {actress.aiReview.keywords.slice(0, 2).map(k => `#${k}`).join(' ')}
              </p>
            ) : !actress.aliases?.length && actress.catchcopy && (
              <p className="hidden sm:block text-xs text-gray-300 truncate">{actress.catchcopy}</p>
            )}
          </div>
        </div>
        <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 hidden sm:inline">{t('releaseCount')}</span>
            <span className="font-semibold">{actress.metrics?.releaseCount || 0}{t('videos')}</span>
          </div>
          {actress.services && actress.services.length > 0 && (
            <div className="flex flex-wrap gap-0.5 sm:gap-1">
              {actress.services.slice(0, 3).map((service) => {
                const meta = providerMeta[service];
                if (!meta) return null;
                return (
                  <span
                    key={service}
                    className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded bg-gradient-to-r ${meta.accentClass}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
              {actress.services.length > 3 && (
                <span className="text-[9px] sm:text-[10px] text-gray-400">+{actress.services.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 通常表示 - imgSrcを使用（エラー時にフォールバックが効く）
  return (
    <div className="bg-gray-900 text-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
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
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent" />
        <div className="absolute top-4 right-4 bg-white rounded-full shadow-md">
          <FavoriteButton type="actress" id={actress.id} />
        </div>
        <div className="absolute bottom-4 left-4">
          <p className="text-sm uppercase tracking-widest text-gray-300">
            {actress.catchcopy}
          </p>
          <h3 className="text-3xl font-semibold">{actress.name}</h3>
          {/* 別名表示 */}
          {actress.aliases && actress.aliases.length > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              ({actress.aliases.slice(0, 3).join(', ')}{actress.aliases.length > 3 ? ' ...' : ''})
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* レビューを優先表示、なければdescription */}
        {actress.aiReview?.overview ? (
          <p className="text-sm text-gray-300 line-clamp-3">{actress.aiReview.overview}</p>
        ) : actress.description && (
          <p className="text-sm text-gray-300 line-clamp-3">{actress.description}</p>
        )}

        {actress.tags && actress.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actress.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs uppercase tracking-wide bg-white/10 text-gray-200 px-3 py-1 rounded-full"
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

        {actress.services && actress.services.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actress.services.map((service) => {
              const meta = providerMeta[service];
              if (!meta) return null;
              return (
                <span
                  key={service}
                  className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${meta.accentClass}`}
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
    <div className="bg-white/5 rounded-xl py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

