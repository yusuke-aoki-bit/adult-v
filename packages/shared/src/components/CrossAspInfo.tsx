'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Globe, ExternalLink } from 'lucide-react';
import { providerMeta, type ProviderId } from '../providers';

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

interface CrossAspInfoProps {
  performerId: number;
  performerName: string;
  aliases: AliasInfo[];
  aspCounts: AspCount[];
  locale: string;
  /** FANZAサイトのベースURL（apps/fanza用） */
  fanzaSiteUrl?: string;
}

const translations = {
  ja: {
    crossAspTitle: 'クロスASP情報',
    aliases: '別名義',
    primary: 'メイン',
    aspDistribution: 'ASP別作品数',
    total: '合計',
    works: '作品',
    showMore: 'もっと見る',
    showLess: '閉じる',
    searchOnAsp: 'で検索',
  },
  en: {
    crossAspTitle: 'Cross-ASP Info',
    aliases: 'Aliases',
    primary: 'Primary',
    aspDistribution: 'Works by ASP',
    total: 'Total',
    works: 'works',
    showMore: 'Show more',
    showLess: 'Show less',
    searchOnAsp: 'Search on',
  },
  zh: {
    crossAspTitle: '跨ASP信息',
    aliases: '别名',
    primary: '主要',
    aspDistribution: '按ASP的作品数',
    total: '总计',
    works: '部',
    showMore: '显示更多',
    showLess: '收起',
    searchOnAsp: '在此搜索',
  },
  ko: {
    crossAspTitle: '크로스 ASP 정보',
    aliases: '별명',
    primary: '메인',
    aspDistribution: 'ASP별 작품 수',
    total: '총',
    works: '작품',
    showMore: '더 보기',
    showLess: '접기',
    searchOnAsp: '에서 검색',
  },
} as const;

type TranslationKey = keyof typeof translations;

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
  fanzaSiteUrl,
}: CrossAspInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[locale as TranslationKey] || translations.ja;

  // データがない場合は表示しない
  if (aliases.length === 0 && aspCounts.length === 0) {
    return null;
  }

  const totalWorks = aspCounts.reduce((sum, asp) => sum + asp.count, 0);
  const sortedAspCounts = [...aspCounts].sort((a, b) => b.count - a.count);
  const displayAliases = isExpanded ? aliases : aliases.slice(0, 5);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-cyan-400" />
        {t.crossAspTitle}
      </h3>

      {/* 別名義セクション */}
      {aliases.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">{t.aliases}</h4>
          <div id="aliases-list" className="flex flex-wrap gap-2">
            {displayAliases.map((alias) => (
              <span
                key={alias.id}
                className={`px-2 py-1 rounded text-sm ${
                  alias.isPrimary
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/30'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {alias.aliasName}
                {alias.isPrimary && (
                  <span className="ml-1 text-xs opacity-70">({t.primary})</span>
                )}
                {alias.source && (
                  <span className="ml-1 text-xs text-gray-500">
                    [{alias.source}]
                  </span>
                )}
              </span>
            ))}
          </div>
          {aliases.length > 5 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              aria-expanded={isExpanded}
              aria-controls="aliases-list"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  {t.showLess}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
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
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center justify-between">
            <span>{t.aspDistribution}</span>
            <span className="text-white">
              {t.total}: <span className="text-cyan-400 font-bold">{totalWorks.toLocaleString()}</span> {t.works}
            </span>
          </h4>
          <div className="space-y-2">
            {sortedAspCounts.map((asp) => {
              const providerId = ASP_TO_PROVIDER[asp.aspName];
              const meta = providerId ? providerMeta[providerId] : null;
              const percentage = totalWorks > 0 ? (asp.count / totalWorks) * 100 : 0;

              // FANZAの場合はfanzaSiteUrlを使用、それ以外は現在のサイト内リンク
              const aspLinkHref = asp.aspName === 'FANZA' && fanzaSiteUrl
                ? `${fanzaSiteUrl}/${locale}/products?q=${encodeURIComponent(performerName)}&includeAsp=${asp.aspName}`
                : `/${locale}/products?q=${encodeURIComponent(performerName)}&includeAsp=${asp.aspName}`;

              return (
                <div key={asp.aspName} className="group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <Link
                      href={aspLinkHref}
                      className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          meta?.accentClass?.replace('from-', 'bg-').split(' ')[0] || 'bg-gray-600'
                        } text-white`}
                      >
                        {meta?.label || asp.aspName}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <span className="text-gray-300">
                      <span className="font-medium text-white">{asp.count.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs ml-1">({percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div
                    className="h-1.5 bg-gray-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(percentage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${meta?.label || asp.aspName}: ${percentage.toFixed(0)}%`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        meta?.accentClass?.includes('from-')
                          ? `bg-gradient-to-r ${meta.accentClass}`
                          : 'bg-cyan-500'
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
