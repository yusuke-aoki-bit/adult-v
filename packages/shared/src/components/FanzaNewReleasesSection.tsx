import { getTranslation, fanzaNewReleasesTranslations } from '../lib/translations';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaNewReleasesSectionProps {
  locale?: string;
  className?: string;
  /** @deprecated 商品データは規約上adult-vで表示不可のため使用しない */
  products?: unknown[];
}

/**
 * FANZA専門サイト（f.adult-v.com）への導線バナー
 * FANZA商品情報（画像・タイトル等）はadult-v上に表示しない（規約対策）
 * f.adult-v.com経由でのみFANZAコンテンツを提供
 */
export function FanzaNewReleasesSection({ locale = 'ja', className = '' }: FanzaNewReleasesSectionProps) {
  const t = getTranslation(fanzaNewReleasesTranslations, locale);
  const fanzaSiteUrl = `${FANZA_SITE_URL}?hl=${locale}`;

  return (
    <section className={`py-4 sm:py-6 ${className}`}>
      <div className="container mx-auto px-3 sm:px-4">
        <a
          href={fanzaSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-xl border border-white/10 bg-white/3 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:bg-white/5 hover:ring-1 hover:ring-fuchsia-400/20 sm:p-6"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500 sm:h-12 sm:w-12">
              <span className="text-xl font-bold text-white sm:text-2xl">F</span>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white sm:text-lg">{t.title}</h2>
              <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">FANZA専門サイトで新作・セール情報をチェック</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-fuchsia-400 transition-colors group-hover:text-fuchsia-300">
              {t.viewMore}
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
      </div>
    </section>
  );
}

export default FanzaNewReleasesSection;
