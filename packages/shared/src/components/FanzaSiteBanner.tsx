'use client';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaSiteBannerProps {
  /** ロケール */
  locale?: string;
  /** バリアント */
  variant?: 'footer' | 'inline' | 'card';
  /** クラス名 */
  className?: string;
}

const translations = {
  ja: {
    title: 'FANZA専門サイト',
    description: 'FANZAの最新作品・セール情報をチェック',
    cta: 'FANZAサイトへ',
    badge: 'FANZA専門',
  },
  en: {
    title: 'FANZA Dedicated Site',
    description: 'Check latest FANZA releases and sales',
    cta: 'Visit FANZA Site',
    badge: 'FANZA Only',
  },
  zh: {
    title: 'FANZA专门网站',
    description: '查看FANZA最新作品和促销信息',
    cta: '访问FANZA网站',
    badge: 'FANZA专属',
  },
  'zh-TW': {
    title: 'FANZA專門網站',
    description: '查看FANZA最新作品和促銷資訊',
    cta: '訪問FANZA網站',
    badge: 'FANZA專屬',
  },
  ko: {
    title: 'FANZA 전문 사이트',
    description: 'FANZA 최신 작품 및 세일 정보 확인',
    cta: 'FANZA 사이트로',
    badge: 'FANZA 전용',
  },
};

/**
 * FANZA専用サイト（f.adult-v.com）への誘導バナー
 * apps/webのフッターやサイドバーに配置
 */
export function FanzaSiteBanner({
  locale = 'ja',
  variant = 'footer',
  className = '',
}: FanzaSiteBannerProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const url = `${FANZA_SITE_URL}?hl=${locale}`;

  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-medium rounded-full transition-all shadow hover:shadow-md ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
        className={`block p-4 bg-linear-to-br from-pink-500/10 to-rose-500/10 hover:from-pink-500/20 hover:to-rose-500/20 border border-pink-500/30 rounded-xl transition-all group ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-linear-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300 transition-colors">
              {t.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {t.description}
            </p>
          </div>
          <svg className="w-5 h-5 text-pink-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className={`block p-4 bg-linear-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 rounded-xl transition-all shadow-lg hover:shadow-xl group ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <div>
            <h4 className="font-bold text-white">{t.title}</h4>
            <p className="text-xs text-white/80">{t.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-white font-medium text-sm">
          {t.cta}
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </div>
    </a>
  );
}

export default FanzaSiteBanner;
