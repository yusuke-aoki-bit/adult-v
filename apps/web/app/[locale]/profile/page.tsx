'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Dna, BookOpen, Search, Film, TrendingUp, Star, ChevronRight } from 'lucide-react';
import { PreferenceChart, PreferenceBarChart } from '@adult-v/shared/components';
import DiscoveryBadges from '@/components/DiscoveryBadges';
import { usePreferenceAnalysis, profileTranslations, useViewingDiary } from '@/hooks';
import { CloudSyncSettings } from '@adult-v/shared/components';
import { getTranslation, cloudSyncTranslations } from '@adult-v/shared/lib/translations';
import { localizedHref } from '@adult-v/shared/i18n';

// Dynamic imports for heavy components to reduce initial bundle size
const BudgetTracker = dynamic(() => import('@/components/BudgetTracker'), {
  loading: () => <div className="h-32 animate-pulse rounded-lg bg-white/5 p-4 ring-1 ring-white/10" />,
  ssr: false,
});
// MakerAnalysis (283 lines)
const MakerAnalysis = dynamic(() => import('@/components/MakerAnalysis'), {
  loading: () => <div className="h-48 animate-pulse rounded-lg bg-white/5 p-4 ring-1 ring-white/10" />,
  ssr: false,
});

type TranslationKey = keyof typeof profileTranslations;
type Translation = (typeof profileTranslations)[TranslationKey];

export default function ProfilePage() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t: Translation = profileTranslations[locale as TranslationKey] || profileTranslations.ja;

  const analysis = usePreferenceAnalysis(locale);
  const { entries, isLoading } = useViewingDiary();

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // データがない場合
  if (analysis.dataCount === 0) {
    return (
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Dna className="h-6 w-6 text-fuchsia-500" />
              {t.title}
            </h1>
            <p className="mt-1 text-gray-400">{t.subtitle}</p>
          </div>

          <div className="rounded-lg bg-white/5 p-8 text-center ring-1 ring-white/10">
            <Film className="mx-auto mb-4 h-16 w-16 text-gray-600" />
            <h2 className="mb-2 text-xl font-bold text-white">{t.noData}</h2>
            <p className="mb-6 text-gray-400">{t.noDataDesc}</p>
            <Link
              href={localizedHref('/products', locale)}
              className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-6 py-3 text-white transition-colors hover:bg-fuchsia-700"
            >
              {t.startViewing}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Dna className="h-6 w-6 text-fuchsia-500" />
            {t.title}
          </h1>
          <p className="mt-1 text-gray-400">{t.subtitle}</p>
          <p className="mt-2 text-sm text-gray-500">
            {analysis.dataCount} {t.basedOn}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* レーダーチャート */}
          <div className="rounded-lg bg-white/5 p-6 ring-1 ring-white/10 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <TrendingUp className="h-5 w-5 text-fuchsia-500" />
              {t.yourPreference}
            </h2>

            <div className="flex flex-col items-center gap-6 md:flex-row">
              {/* レーダーチャート */}
              <div className="shrink-0">
                {analysis.radarData.length >= 3 ? (
                  <PreferenceChart data={analysis.radarData} size={280} theme="dark" />
                ) : (
                  <PreferenceBarChart data={analysis.radarData} className="w-full max-w-xs" theme="dark" />
                )}
              </div>

              {/* サマリー */}
              <div className="flex-1">
                {analysis.summary && (
                  <div className="bg-gray-750 mb-4 rounded-lg p-4">
                    <p className="text-white">{analysis.summary}</p>
                  </div>
                )}

                {/* トップカテゴリ */}
                {analysis.topPreferences.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-gray-400">{t.topCategories}</h3>
                    <div className="space-y-2">
                      {analysis.topPreferences.map((pref, index) => (
                        <div key={pref.category} className="flex items-center gap-3">
                          <span className="w-6 text-lg font-bold text-fuchsia-400">{index + 1}</span>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="font-medium text-white">{pref.label}</span>
                              <span className="text-sm text-fuchsia-400">{pref.score}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-fuchsia-600 to-fuchsia-400"
                                style={{ width: `${pref.score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* サイドバー */}
          <div className="space-y-4">
            {/* 発掘者バッジ */}
            <DiscoveryBadges locale={locale} />

            {/* 視聴予算管理 */}
            <BudgetTracker locale={locale} />

            {/* メーカー分析 */}
            <MakerAnalysis locale={locale} />

            {/* クラウド同期設定 */}
            <CloudSyncSettings translations={getTranslation(cloudSyncTranslations, locale)} />

            {/* おすすめキーワード */}
            {analysis.recommendedKeywords.length > 0 && (
              <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
                  <Star className="h-4 w-4 text-yellow-400" />
                  {t.recommendedKeywords}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendedKeywords.map((keyword) => (
                    <Link
                      key={keyword}
                      href={localizedHref(`/products?q=${encodeURIComponent(keyword)}`, locale)}
                      className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-sm text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-fuchsia-600 hover:text-white hover:ring-fuchsia-500/30"
                    >
                      <Search className="h-3 w-3" />
                      {keyword}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 視聴日記リンク */}
            <Link
              href={localizedHref('/diary', locale)}
              className="hover:bg-gray-750 group block rounded-lg bg-white/5 p-4 ring-1 ring-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-fuchsia-500" />
                  <div>
                    <span className="font-medium text-white">{t.viewDiary}</span>
                    <p className="text-sm text-gray-400">{entries.length} entries</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500 transition-colors group-hover:text-fuchsia-400" />
              </div>
            </Link>

            {/* 最近の視聴 */}
            {entries.length > 0 && (
              <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                <h3 className="mb-3 text-sm font-medium text-gray-400">Recent Views</h3>
                <div className="space-y-2">
                  {entries.slice(0, 5).map((entry) => (
                    <Link
                      key={entry.id}
                      href={localizedHref(`/products/${entry.productId}`, locale)}
                      className="block truncate text-sm text-gray-300 transition-colors hover:text-fuchsia-400"
                    >
                      {entry.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 h-8 w-48 animate-pulse rounded bg-gray-700" />
        <div className="h-5 w-64 animate-pulse rounded bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-lg bg-white/5 p-6 ring-1 ring-white/10 lg:col-span-2" />
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-white/5 p-4 ring-1 ring-white/10" />
          <div className="h-24 animate-pulse rounded-lg bg-white/5 p-4 ring-1 ring-white/10" />
        </div>
      </div>
    </div>
  );
}
