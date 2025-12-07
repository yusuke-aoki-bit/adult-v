'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Campaign } from '@/types/product';
import { providerMeta } from '@/lib/providers';

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

interface Props {
  campaign: Campaign;
}

export default function CampaignCard({ campaign }: Props) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const provider = providerMeta[campaign.provider];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col">
      <div className={`p-4 rounded-t-2xl text-white bg-gradient-to-r ${provider.accentClass}`}>
        <p className="text-sm uppercase tracking-wide text-white/80">{provider.label}</p>
        <h3 className="text-xl font-semibold">{campaign.title}</h3>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-4">
        <p className="text-gray-700">{campaign.description}</p>
        <p className="text-sm text-gray-500">{campaign.highlight}</p>

        <div className="flex flex-wrap gap-2">
          {campaign.badge && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-900 text-white">
              {campaign.badge}
            </span>
          )}
          {campaign.genres?.map((genre) => (
            <span
              key={genre}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
            >
              #{genre.toUpperCase()}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t.expiresAt} {campaign.expiresAt}</span>
          <span className="font-medium text-gray-700">{provider.label}</span>
        </div>

        <Link
          href={campaign.ctaUrl}
          target="_blank"
          className="inline-flex items-center justify-center w-full rounded-xl border border-gray-900 text-gray-900 font-semibold py-3 hover:bg-gray-900 hover:text-white transition-colors"
        >
          {t.viewDetails}
        </Link>
      </div>
    </div>
  );
}

