'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { memo, useMemo } from 'react';
import { Campaign } from '../types/product';
import { providerMeta } from '../lib/providers';

export type CampaignCardTheme = 'dark' | 'light';

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    expiresAt: '終了予定:',
    viewDetails: '詳細と参加条件を見る',
  },
  en: {
    expiresAt: 'Ends:',
    viewDetails: 'View Details & Conditions',
  },
  zh: {
    expiresAt: '结束日期:',
    viewDetails: '查看详情和参与条件',
  },
  ko: {
    expiresAt: '종료 예정:',
    viewDetails: '상세 및 참여 조건 보기',
  },
} as const;

// Theme configuration
const themeConfig = {
  dark: {
    container: 'bg-gray-800 rounded-2xl shadow-lg border border-gray-700 flex flex-col',
    description: 'text-gray-200',
    highlight: 'text-sm text-gray-400',
    badgeBg: 'bg-white text-gray-900',
    genreBg: 'bg-gray-700 text-gray-300',
    expiresText: 'text-sm text-gray-400',
    providerLabel: 'font-medium text-gray-300',
    ctaButton: 'inline-flex items-center justify-center w-full rounded-xl border border-white text-white font-semibold py-3 hover:bg-white hover:text-gray-900 transition-colors',
  },
  light: {
    container: 'bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col',
    description: 'text-gray-700',
    highlight: 'text-sm text-gray-500',
    badgeBg: 'bg-gray-900 text-white',
    genreBg: 'bg-gray-100 text-gray-600',
    expiresText: 'text-sm text-gray-500',
    providerLabel: 'font-medium text-gray-700',
    ctaButton: 'inline-flex items-center justify-center w-full rounded-xl border border-gray-900 text-gray-900 font-semibold py-3 hover:bg-gray-900 hover:text-white transition-colors',
  },
} as const;

interface Props {
  campaign: Campaign;
  theme?: CampaignCardTheme;
}

function CampaignCardComponent({ campaign, theme = 'light' }: Props) {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  // Memoize translation object to prevent recreation on each render
  const t = useMemo(
    () => translations[locale as keyof typeof translations] || translations.ja,
    [locale]
  );
  const provider = providerMeta[campaign.provider];
  const colors = themeConfig[theme];

  return (
    <div className={colors.container}>
      <div className={`p-4 rounded-t-2xl text-white bg-linear-to-r ${provider.accentClass}`}>
        <p className="text-sm uppercase tracking-wide text-white/80">{provider.label}</p>
        <h3 className="text-xl font-semibold">{campaign.title}</h3>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-4">
        <p className={colors.description}>{campaign.description}</p>
        <p className={colors.highlight}>{campaign.highlight}</p>

        <div className="flex flex-wrap gap-2">
          {campaign.badge && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.badgeBg}`}>
              {campaign.badge}
            </span>
          )}
          {campaign.genres?.map((genre) => (
            <span
              key={genre}
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.genreBg}`}
            >
              #{genre.toUpperCase()}
            </span>
          ))}
        </div>

        <div className={`flex items-center justify-between ${colors.expiresText}`}>
          <span>{t.expiresAt} {campaign.expiresAt}</span>
          <span className={colors.providerLabel}>{provider.label}</span>
        </div>

        <Link
          href={campaign.ctaUrl}
          target="_blank"
          className={colors.ctaButton}
        >
          {t.viewDetails}
        </Link>
      </div>
    </div>
  );
}

// Memoize to prevent re-renders in campaign list
const CampaignCard = memo(CampaignCardComponent);
export default CampaignCard;

