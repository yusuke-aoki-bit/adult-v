'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Globe, ExternalLink } from 'lucide-react';
import { providerMeta, type ProviderId } from '../providers';
import { getTranslation, crossAspInfoTranslations } from '../lib/translations';

interface AliasInfo {
  id: number;
  aliasName: string;
  source: string | null;
  isPrimary: boolean | null;
}

interface AspCount {
  aspName: string;
  count: number;
}

// デフォルトのFANZAサイトURL
const DEFAULT_FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface CrossAspInfoProps {
  performerId: number;
  performerName: string;
  aliases: AliasInfo[];
  aspCounts: AspCount[];
  locale: string;
  /** FANZAサイトのベースURL（デフォルト: f.adult-v.com） */
  fanzaSiteUrl?: string;
  /** FANZAへのリンクを非表示にする（apps/fanza用） */
  hideFanzaLink?: boolean;
}

// ASP名からProviderIdへのマッピング
const ASP_TO_PROVIDER: Record<string, ProviderId> = {
  FANZA: 'fanza',
  MGS: 'mgs',
  DUGA: 'duga',
  SOKMIL: 'sokmil',
  FC2: 'fc2',
  B10F: 'b10f',
  JAPANSKA: 'japanska',
  caribbeancom: 'caribbeancom',
  caribbeancompr: 'caribbeancompr',
  '1pondo': '1pondo',
  heyzo: 'heyzo',
  '10musume': '10musume',
  pacopacomama: 'pacopacomama',
  tokyohot: 'tokyohot',
};

export default function CrossAspInfo({
  performerId,
  performerName,
  aliases,
  aspCounts,
  locale,
  fanzaSiteUrl = DEFAULT_FANZA_SITE_URL,
  hideFanzaLink = false,
}: CrossAspInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = getTranslation(crossAspInfoTranslations, locale);

  // データがない場合は表示しない
  if (aliases.length === 0 && aspCounts.length === 0) {
    return null;
  }

  const totalWorks = aspCounts.reduce((sum, asp) => sum + asp.count, 0);
  const sortedAspCounts = [...aspCounts].sort((a, b) => b.count - a.count);
  const displayAliases = isExpanded ? aliases : aliases.slice(0, 5);

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
        <Globe className="h-5 w-5 text-cyan-400" />
        {t.crossAspTitle}
      </h3>

      {/* 別名義セクション */}
      {aliases.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-gray-400">{t.aliases}</h4>
          <div id="aliases-list" className="flex flex-wrap gap-2">
            {displayAliases.map((alias) => (
              <span
                key={alias.id}
                className={`rounded px-2 py-1 text-sm ${
                  alias.isPrimary
                    ? 'border border-cyan-500/30 bg-cyan-600/30 text-cyan-300'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {alias.aliasName}
                {alias.isPrimary && <span className="ml-1 text-xs opacity-70">({t.primary})</span>}
                {alias.source && <span className="ml-1 text-xs text-gray-500">[{alias.source}]</span>}
              </span>
            ))}
          </div>
          {aliases.length > 5 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
              aria-expanded={isExpanded}
              aria-controls="aliases-list"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  {t.showLess}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  {t.showMore} ({aliases.length - 5})
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ASP別作品数セクション */}
      {aspCounts.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center justify-between text-sm font-medium text-gray-400">
            <span>{t.aspDistribution}</span>
            <span className="text-white">
              {t.total}: <span className="font-bold text-cyan-400">{totalWorks.toLocaleString()}</span> {t.works}
            </span>
          </h4>
          <div className="space-y-2">
            {sortedAspCounts
              // hideFanzaLinkがtrueの場合はFANZAを除外（大文字小文字を正規化して比較）
              .filter((asp) => !(hideFanzaLink && asp.aspName.toUpperCase() === 'FANZA'))
              .map((asp) => {
                const providerId = ASP_TO_PROVIDER[asp.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                const percentage = totalWorks > 0 ? (asp.count / totalWorks) * 100 : 0;

                // FANZAの場合は常に外部リンク（f.adult-v.com）
                // aspNameは大文字小文字が混在する可能性があるため正規化して比較
                const isFanza = asp.aspName.toUpperCase() === 'FANZA';
                // 演者詳細ページに asp パラメータでフィルターするリンクを生成
                const aspLinkHref = isFanza
                  ? `${fanzaSiteUrl}/actress/${performerId}?hl=${locale}`
                  : `/${locale}/actress/${performerId}?asp=${asp.aspName.toLowerCase()}`;

                const linkContent = (
                  <>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        meta?.accentClass?.replace('from-', 'bg-').split(' ')[0] || 'bg-gray-600'
                      } text-white`}
                    >
                      {meta?.label || asp.aspName}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                );

                return (
                  <div key={asp.aspName} className="group">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      {isFanza ? (
                        <a
                          href={aspLinkHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 transition-colors hover:text-cyan-400"
                        >
                          {linkContent}
                        </a>
                      ) : (
                        <Link
                          href={aspLinkHref}
                          className="flex items-center gap-2 transition-colors hover:text-cyan-400"
                        >
                          {linkContent}
                        </Link>
                      )}
                      <span className="text-gray-300">
                        <span className="font-medium text-white">{asp.count.toLocaleString()}</span>
                        <span className="ml-1 text-xs text-gray-500">({percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-gray-700"
                      role="progressbar"
                      aria-valuenow={Math.round(percentage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${meta?.label || asp.aspName}: ${percentage.toFixed(0)}%`}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          meta?.accentClass?.includes('from-') ? `bg-linear-to-r ${meta.accentClass}` : 'bg-cyan-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
