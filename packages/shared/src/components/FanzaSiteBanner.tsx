'use client';

import { getTranslation, fanzaSiteBannerTranslations } from '../lib/translations';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaSiteBannerProps {
  /** ロケール */
  locale?: string;
  /** バリアント */
  variant?: 'footer' | 'inline' | 'card';
  /** クラス名 */
  className?: string;
}

/**
 * FANZA専用サイト（f.adult-v.com）への誘導バナー
 * apps/webのフッターやサイドバーに配置
 */
export function FanzaSiteBanner({ locale = 'ja', variant = 'footer', className = '' }: FanzaSiteBannerProps) {
  const t = getTranslation(fanzaSiteBannerTranslations, locale);
  const url = `${FANZA_SITE_URL}?hl=${locale}`;

  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-full bg-linear-to-r from-fuchsia-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white shadow transition-all hover:from-fuchsia-600 hover:to-fuchsia-600 hover:shadow-md ${className}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {t.badge}
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group block rounded-xl border border-fuchsia-500/30 bg-linear-to-br from-fuchsia-500/10 to-fuchsia-500/10 p-4 transition-all hover:from-fuchsia-500/20 hover:to-fuchsia-500/20 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-fuchsia-500 to-fuchsia-500">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-pink-600 transition-colors group-hover:text-pink-700 dark:text-fuchsia-400 dark:group-hover:text-fuchsia-300">
              {t.title}
            </h4>
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">{t.description}</p>
          </div>
          <svg
            className="h-5 w-5 text-fuchsia-500 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>
    );
  }

  // footer variant (default)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl bg-linear-to-r from-fuchsia-600 to-fuchsia-600 p-4 shadow-lg transition-all hover:from-fuchsia-700 hover:to-fuchsia-700 hover:shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <span className="text-xl font-bold text-white">F</span>
          </div>
          <div>
            <h4 className="font-bold text-white">{t.title}</h4>
            <p className="text-xs text-white/80">{t.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-white">
          {t.cta}
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </div>
    </a>
  );
}

export default FanzaSiteBanner;
