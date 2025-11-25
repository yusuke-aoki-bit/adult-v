'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Actress } from '@/types/product';
import { providerMeta } from '@/lib/providers';
import { normalizeImageUrl } from '@/lib/image-utils';
import FavoriteButton from './FavoriteButton';

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE';

interface Props {
  actress: Actress;
  compact?: boolean;
}

export default function ActressCard({ actress, compact = false }: Props) {
  const [imgSrc, setImgSrc] = useState(normalizeImageUrl(actress.thumbnail || actress.heroImage) || PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  if (compact) {
    // コンパクト表示: 名前と基本情報のみ
    return (
      <div className="bg-gray-900 text-white rounded-lg overflow-hidden shadow-lg ring-1 ring-white/10 hover:ring-white/20 transition-all">
        <div className="relative aspect-4/5">
          <Image
            src={imgSrc}
            alt={actress.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover opacity-90"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent" />
          <div className="absolute top-2 right-2 bg-white rounded-full shadow-md">
            <FavoriteButton type="actress" id={actress.id} />
          </div>
          <div className="absolute bottom-2 left-2 right-2">
            <h3 className="text-lg font-semibold truncate">{actress.name}</h3>
            {actress.catchcopy && (
              <p className="text-xs text-gray-300 truncate">{actress.catchcopy}</p>
            )}
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">出演数</span>
            <span className="font-semibold">{actress.metrics?.releaseCount || 0}本</span>
          </div>
          {actress.tags && actress.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {actress.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-white/10 text-gray-200 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 通常表示
  const heroSrc = normalizeImageUrl(actress.heroImage) || imgSrc;
  return (
    <div className="bg-gray-900 text-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
      <div className="relative aspect-4/5">
        <Image
          src={heroSrc}
          alt={actress.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover opacity-90"
          loading="lazy"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          onError={handleImageError}
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
        </div>
      </div>

      <div className="p-6 space-y-4">
        {actress.description && (
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
            <Stat label="出演数" value={`${actress.metrics.releaseCount || 0}本`} />
            <Stat label="トレンド" value={actress.metrics.trendingScore || 0} />
            <Stat label="支持率" value={`${actress.metrics.fanScore || 0}%`} />
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

