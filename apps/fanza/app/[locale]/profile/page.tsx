'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { localizedHref } from '@adult-v/shared/i18n';
import { Dna, BookOpen, Search, Film, TrendingUp, Star, ChevronRight } from 'lucide-react';
import PreferenceChart, { PreferenceBarChart } from '@/components/PreferenceChart';
import DiscoveryBadges from '@/components/DiscoveryBadges';
import { usePreferenceAnalysis, useViewingDiary } from '@/hooks';
import { profileTranslations } from '@adult-v/shared/hooks';
import { CloudSyncSettings, PageSectionNav } from '@adult-v/shared/components';
import { getTranslation, cloudSyncTranslations } from '@adult-v/shared/lib/translations';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';

// Dynamic imports for heavy components to reduce initial bundle size
const BudgetTracker = dynamic(() => import('@/components/BudgetTracker'), {
  loading: () => <div className="h-32 animate-pulse rounded-lg border border-gray-200 bg-white p-4" />,
  ssr: false,
});
// MakerAnalysis (283 lines)
const MakerAnalysis = dynamic(() => import('@/components/MakerAnalysis'), {
  loading: () => <div className="h-48 animate-pulse rounded-lg border border-gray-200 bg-white p-4" />,
  ssr: false,
});

type TranslationKey = keyof typeof profileTranslations;
type Translation = (typeof profileTranslations)[TranslationKey];

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

export default function ProfilePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t: Translation = profileTranslations[locale as TranslationKey] || profileTranslations.ja;

  const analysis = usePreferenceAnalysis(locale);
  const { entries, isLoading } = useViewingDiary();

  // PageLayout用のデータ
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    fetch('/api/products/on-sale?limit=24&minDiscount=30')
      .then((res) => res.json())
      .then((data) => setSaleProducts(data.products || []))
      .catch(() => {});

    fetch('/api/products/uncategorized-count')
      .then((res) => res.json())
      .then((data) => setUncategorizedCount(data.count || 0))
      .catch(() => {});
  }, []);

  const layoutTranslations = {
    viewProductList: '作品一覧',
    viewProductListDesc: 'FANZA作品を横断検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  // セクションナビゲーション用の翻訳
  const sectionLabels: Record<string, string> = {
    ja: 'DNA分析',
    en: 'DNA Analysis',
    zh: 'DNA分析',
    'zh-TW': 'DNA分析',
    ko: 'DNA분석',
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // データがない場合
  if (analysis.dataCount === 0) {
    return (
      <div className="theme-body min-h-screen">
        {/* セクションナビゲーション */}
        <PageSectionNav
          locale={locale}
          config={{
            hasSale: saleProducts.length > 0,
            hasRecentlyViewed: true,
            mainSectionId: 'profile',
            mainSectionLabel: sectionLabels[locale] ?? sectionLabels.ja!,
            hasRecommendations: true,
            hasWeeklyHighlights: true,
            hasTrending: true,
            hasAllProducts: true,
          }}
          theme="light"
          pageId="profile"
        />

        {/* 上部セクション */}
        <section className="py-3 sm:py-4">
          <div className="container mx-auto px-3 sm:px-4">
            <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="profile" />
          </div>
        </section>

        <div id="profile" className="container mx-auto scroll-mt-20 px-4 py-8">
          <div className="mb-8">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <Dna className="h-6 w-6 text-rose-600" />
              {t.title}
            </h1>
            <p className="mt-1 text-gray-500">{t.subtitle}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <Film className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h2 className="mb-2 text-xl font-bold text-gray-800">{t.noData}</h2>
            <p className="mb-6 text-gray-500">{t.noDataDesc}</p>
            <Link
              href={localizedHref('/products', locale)}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-white transition-colors hover:bg-rose-700"
            >
              {t.startViewing}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* 下部セクション */}
        <section className="py-3 sm:py-4">
          <div className="container mx-auto px-3 sm:px-4">
            <TopPageLowerSections
              locale={locale}
              uncategorizedCount={uncategorizedCount}
              isTopPage={false}
              isFanzaSite={true}
              translations={layoutTranslations}
              pageId="profile"
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション */}
      <PageSectionNav
        locale={locale}
        config={{
          hasSale: saleProducts.length > 0,
          hasRecentlyViewed: true,
          mainSectionId: 'profile',
          mainSectionLabel: sectionLabels[locale] ?? sectionLabels.ja!,
          hasRecommendations: true,
          hasWeeklyHighlights: true,
          hasTrending: true,
          hasAllProducts: true,
        }}
        theme="light"
        pageId="profile"
      />

      {/* 上部セクション */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="profile" />
        </div>
      </section>

      <div id="profile" className="container mx-auto scroll-mt-20 px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <Dna className="h-6 w-6 text-rose-600" />
            {t.title}
          </h1>
          <p className="mt-1 text-gray-500">{t.subtitle}</p>
          <p className="mt-2 text-sm text-gray-500">
            {analysis.dataCount} {t.basedOn}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* レーダーチャート */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
              <TrendingUp className="h-5 w-5 text-rose-600" />
              {t.yourPreference}
            </h2>

            <div className="flex flex-col items-center gap-6 md:flex-row">
              {/* レーダーチャート */}
              <div className="shrink-0">
                {analysis.radarData.length >= 3 ? (
                  <PreferenceChart data={analysis.radarData} size={280} />
                ) : (
                  <PreferenceBarChart data={analysis.radarData} className="w-full max-w-xs" />
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
                          <span className="w-6 text-lg font-bold text-rose-400">{index + 1}</span>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="font-medium text-white">{pref.label}</span>
                              <span className="text-sm text-rose-400">{pref.score}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-rose-600 to-rose-400"
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
              <div className="rounded-lg bg-gray-800 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
                  <Star className="h-4 w-4 text-yellow-400" />
                  {t.recommendedKeywords}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendedKeywords.map((keyword) => (
                    <Link
                      key={keyword}
                      href={localizedHref('/products', locale, { q: encodeURIComponent(keyword) })}
                      className="flex items-center gap-1 rounded-full bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-rose-600 hover:text-white"
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
              className="hover:bg-gray-750 group block rounded-lg bg-gray-800 p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-rose-500" />
                  <div>
                    <span className="font-medium text-white">{t.viewDiary}</span>
                    <p className="text-sm text-gray-400">{entries.length} entries</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500 transition-colors group-hover:text-rose-400" />
              </div>
            </Link>

            {/* 最近の視聴 */}
            {entries.length > 0 && (
              <div className="rounded-lg bg-gray-800 p-4">
                <h3 className="mb-3 text-sm font-medium text-gray-400">Recent Views</h3>
                <div className="space-y-2">
                  {entries.slice(0, 5).map((entry) => (
                    <Link
                      key={entry.id}
                      href={localizedHref(`/products/${entry.productId}`, locale)}
                      className="block truncate text-sm text-gray-300 transition-colors hover:text-rose-400"
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

      {/* 下部セクション */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={false}
            isFanzaSite={true}
            translations={layoutTranslations}
            pageId="profile"
          />
        </div>
      </section>
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
        <div className="h-96 animate-pulse rounded-lg bg-gray-800 p-6 lg:col-span-2" />
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-gray-800 p-4" />
          <div className="h-24 animate-pulse rounded-lg bg-gray-800 p-4" />
        </div>
      </div>
    </div>
  );
}
