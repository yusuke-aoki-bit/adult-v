'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Dna,
  BookOpen,
  Search,
  Film,
  TrendingUp,
  Star,
  ChevronRight,
} from 'lucide-react';
import PreferenceChart, { PreferenceBarChart } from '@/components/PreferenceChart';
import DiscoveryBadges from '@/components/DiscoveryBadges';
import { usePreferenceAnalysis, useViewingDiary } from '@/hooks';
import { profileTranslations } from '@adult-v/shared/hooks';
import { CloudSyncSettings, cloudSyncTranslations } from '@adult-v/shared/components';

// Dynamic imports for heavy components to reduce initial bundle size
const BudgetTracker = dynamic(() => import('@/components/BudgetTracker'), {
  loading: () => (
    <div className="bg-white rounded-lg p-4 h-32 animate-pulse border border-gray-200" />
  ),
  ssr: false,
});
// MakerAnalysis (283 lines)
const MakerAnalysis = dynamic(() => import('@/components/MakerAnalysis'), {
  loading: () => (
    <div className="bg-white rounded-lg p-4 h-48 animate-pulse border border-gray-200" />
  ),
  ssr: false,
});

type TranslationKey = keyof typeof profileTranslations;
type Translation = typeof profileTranslations[TranslationKey];

export default function ProfilePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t: Translation = profileTranslations[locale as TranslationKey] || profileTranslations.ja;

  const analysis = usePreferenceAnalysis(locale);
  const { entries, isLoading } = useViewingDiary();

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // データがない場合
  if (analysis.dataCount === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Dna className="w-6 h-6 text-rose-500" />
            {t.title}
          </h1>
          <p className="text-gray-400 mt-1">{t.subtitle}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t.noData}</h2>
          <p className="text-gray-400 mb-6">{t.noDataDesc}</p>
          <Link
            href={`/${locale}/products`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
          >
            {t.startViewing}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Dna className="w-6 h-6 text-rose-500" />
          {t.title}
        </h1>
        <p className="text-gray-400 mt-1">{t.subtitle}</p>
        <p className="text-sm text-gray-500 mt-2">
          {analysis.dataCount} {t.basedOn}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* レーダーチャート */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-500" />
            {t.yourPreference}
          </h2>

          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* レーダーチャート */}
            <div className="flex-shrink-0">
              {analysis.radarData.length >= 3 ? (
                <PreferenceChart data={analysis.radarData} size={280} />
              ) : (
                <PreferenceBarChart data={analysis.radarData} className="w-full max-w-xs" />
              )}
            </div>

            {/* サマリー */}
            <div className="flex-1">
              {analysis.summary && (
                <div className="bg-gray-750 rounded-lg p-4 mb-4">
                  <p className="text-white">{analysis.summary}</p>
                </div>
              )}

              {/* トップカテゴリ */}
              {analysis.topPreferences.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">{t.topCategories}</h3>
                  <div className="space-y-2">
                    {analysis.topPreferences.map((pref, index) => (
                      <div
                        key={pref.category}
                        className="flex items-center gap-3"
                      >
                        <span className="text-rose-400 font-bold text-lg w-6">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-white font-medium">{pref.label}</span>
                            <span className="text-rose-400 text-sm">{pref.score}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
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
          <CloudSyncSettings
            translations={cloudSyncTranslations[locale as keyof typeof cloudSyncTranslations] || cloudSyncTranslations.ja}
          />

          {/* おすすめキーワード */}
          {analysis.recommendedKeywords.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                {t.recommendedKeywords}
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.recommendedKeywords.map((keyword) => (
                  <Link
                    key={keyword}
                    href={`/${locale}/products?q=${encodeURIComponent(keyword)}`}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-rose-600 text-gray-300 hover:text-white text-sm rounded-full transition-colors flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 視聴日記リンク */}
          <Link
            href={`/${locale}/diary`}
            className="block bg-gray-800 hover:bg-gray-750 rounded-lg p-4 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-rose-500" />
                <div>
                  <span className="text-white font-medium">{t.viewDiary}</span>
                  <p className="text-sm text-gray-400">{entries.length} entries</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-rose-400 transition-colors" />
            </div>
          </Link>

          {/* 最近の視聴 */}
          {entries.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Views</h3>
              <div className="space-y-2">
                {entries.slice(0, 5).map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/${locale}/products/${entry.productId}`}
                    className="block text-sm text-gray-300 hover:text-rose-400 truncate transition-colors"
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
  );
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-5 w-64 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 h-96 animate-pulse" />
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4 h-32 animate-pulse" />
          <div className="bg-gray-800 rounded-lg p-4 h-24 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
