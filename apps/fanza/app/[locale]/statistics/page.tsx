import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import {
  getMonthlyReleaseStats,
  getTopPerformersByProductCount,
  getTopGenres,
  getYearlyStats,
  getOverallStats,
  getCurrentMonthReleases,
  getNewPerformersThisYear,
  getMakerShareStats,
  getGenreTrends,
  getDebutTrends,
} from '@adult-v/shared/db-queries';
import {
  DynamicReleasesTrendChart,
  DynamicGenreDistributionChart,
  DynamicYearlyStatsChart,
  DynamicMakerShareChart,
  DynamicGenreTrendChart,
  DynamicDebutTrendChart,
} from '@adult-v/shared/components/stats';
import { SocialShareButtons } from '@adult-v/shared/components';
import { localizedHref } from '@adult-v/shared/i18n';

// 統計ページは変更頻度が低いためISRで1時間キャッシュ
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    ja: 'AV業界統計・ランキング | 作品数・女優ランキング・トレンド分析',
    en: 'AV Industry Statistics & Rankings | Product Counts, Actress Rankings, Trend Analysis',
    zh: 'AV行业统计与排名 | 作品数量、女优排名、趋势分析',
    'zh-TW': 'AV產業統計與排名 | 作品數量、女優排名、趨勢分析',
    ko: 'AV 업계 통계 및 순위 | 작품 수, 여배우 순위, 트렌드 분석',
  };

  const descriptions: Record<string, string> = {
    ja: 'AV業界の最新統計データ。月別リリース数の推移、人気女優ランキング、ジャンル別作品数、年別トレンドなど、業界動向を詳細に分析。',
    en: 'Latest AV industry statistics. Monthly release trends, top actress rankings, genre distribution, yearly trends and more.',
    zh: '最新AV行业统计数据。月度发行趋势、热门女优排名、类型分布、年度趋势等。',
    'zh-TW': '最新AV產業統計資料。月度發行趨勢、熱門女優排名、類型分佈、年度趨勢等。',
    ko: '최신 AV 업계 통계. 월별 출시 동향, 인기 여배우 순위, 장르 분포, 연간 트렌드 등.',
  };

  return generateBaseMetadata(
    titles[locale] ?? titles.ja!,
    descriptions[locale] ?? descriptions.ja!,
    undefined,
    '/statistics',
    undefined,
    locale,
  );
}

export default async function StatisticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 並列でデータ取得
  const [
    monthlyStats,
    topPerformers,
    topGenres,
    yearlyStats,
    overallStats,
    currentMonthReleases,
    newPerformers,
    makerStats,
    genreTrends,
    debutTrends,
  ] = await Promise.all([
    getMonthlyReleaseStats(24),
    getTopPerformersByProductCount(20),
    getTopGenres(20),
    getYearlyStats(),
    getOverallStats(),
    getCurrentMonthReleases(),
    getNewPerformersThisYear(),
    getMakerShareStats(20),
    getGenreTrends(12, 10),
    getDebutTrends(10),
  ]);

  // 構造化データ
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AV業界統計データ',
    description: 'AV業界の作品数、女優ランキング、ジャンル分布などの統計データ',
    creator: {
      '@type': 'Organization',
      name: 'Adult-V',
    },
    temporalCoverage: `2015/${currentYear}`,
    distribution: {
      '@type': 'DataDownload',
      contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/statistics`,
      encodingFormat: 'text/html',
    },
  };

  const breadcrumbItems = [
    { label: 'ホーム', href: '/' },
    { label: '統計・ランキング', href: '/statistics' },
  ];

  return (
    <div className="theme-body min-h-screen">
      <section id="statistics" className="scroll-mt-20">
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <JsonLD data={structuredData} />

          <Breadcrumb items={breadcrumbItems} />

          <div className="mt-4 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="theme-text mb-2 text-3xl font-bold">AV業界統計・ランキング</h1>
              <p className="theme-text-secondary">
                {currentYear}年{currentMonth}月更新 - 業界の最新動向をデータで分析
              </p>
            </div>
            <div className="shrink-0">
              <SocialShareButtons
                title="AV業界統計・ランキング - 最新データで業界動向を分析"
                url={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/statistics`}
                showAll={true}
                hashtags={['AV統計', 'ランキング']}
              />
            </div>
          </div>

          {/* 概要統計カード */}
          <section className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="総作品数" value={overallStats.totalProducts.toLocaleString()} suffix="作品" />
            <StatCard label="登録女優数" value={overallStats.totalPerformers.toLocaleString()} suffix="名" />
            <StatCard label="今月の新作" value={currentMonthReleases.toLocaleString()} suffix="作品" />
            <StatCard label={`${currentYear}年デビュー`} value={newPerformers.toLocaleString()} suffix="名" />
          </section>

          {/* 月別リリース推移 */}
          <section className="mb-12">
            <h2 className="theme-text mb-4 text-2xl font-bold">月別リリース数の推移</h2>
            <p className="theme-text-secondary mb-4">過去24ヶ月間の新作リリース数の推移を表示しています。</p>
            <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
              <DynamicReleasesTrendChart data={monthlyStats} />
            </div>
          </section>

          {/* 年別統計 */}
          <section className="mb-12">
            <h2 className="theme-text mb-4 text-2xl font-bold">年別作品数・出演女優数</h2>
            <p className="theme-text-secondary mb-4">2015年以降の年別作品数と出演女優数の推移。</p>
            <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
              <DynamicYearlyStatsChart data={yearlyStats} />
            </div>
          </section>

          {/* 2カラムレイアウト: 女優ランキング & ジャンル */}
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            {/* 人気女優ランキング */}
            <section>
              <h2 className="theme-text mb-4 text-2xl font-bold">作品数ランキング TOP20</h2>
              <p className="theme-text-secondary mb-4">出演作品数が多い女優のランキング。</p>
              <div className="theme-content theme-border overflow-hidden rounded-lg border shadow-sm">
                <table className="w-full">
                  <thead className="bg-pink-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">順位</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">女優名</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">作品数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {topPerformers.map((performer, index) => (
                      <tr key={performer.id} className="hover:bg-pink-50/50">
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-bold ${index < 3 ? 'text-yellow-500' : 'text-gray-500'}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={localizedHref(`/actress/${performer.id}`, locale)}
                            className="text-pink-600 hover:text-pink-700 hover:underline"
                          >
                            {performer.name}
                          </Link>
                        </td>
                        <td className="theme-text-secondary px-4 py-3 text-right text-sm">
                          {performer.productCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ジャンル分布 */}
            <section>
              <h2 className="theme-text mb-4 text-2xl font-bold">人気ジャンル TOP20</h2>
              <p className="theme-text-secondary mb-4">作品数の多いジャンルランキング。</p>
              <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
                <DynamicGenreDistributionChart data={topGenres} />
              </div>
            </section>
          </div>

          {/* メーカーシェア */}
          <section className="mb-12">
            <h2 className="theme-text mb-4 text-2xl font-bold">メーカー別シェア TOP20</h2>
            <p className="theme-text-secondary mb-4">作品数が多いメーカーのランキング。業界シェアを可視化。</p>
            <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
              <DynamicMakerShareChart data={makerStats} />
            </div>
          </section>

          {/* ジャンルトレンド */}
          <section className="mb-12">
            <h2 className="theme-text mb-4 text-2xl font-bold">ジャンル別トレンド（過去12ヶ月）</h2>
            <p className="theme-text-secondary mb-4">人気TOP10ジャンルの月別推移。トレンドの変化を分析。</p>
            <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
              <DynamicGenreTrendChart data={genreTrends} />
            </div>
          </section>

          {/* 新人デビュー統計 */}
          <section className="mb-12">
            <h2 className="theme-text mb-4 text-2xl font-bold">年別新人デビュー数</h2>
            <p className="theme-text-secondary mb-4">過去10年間の新人デビュー数の推移。</p>
            <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
              <DynamicDebutTrendChart data={debutTrends} />
            </div>
          </section>

          {/* ウィジェット埋め込みガイド */}
          <section className="mb-12 rounded-lg border border-pink-200 bg-pink-50 p-6">
            <h2 className="theme-text mb-4 text-xl font-bold">統計ウィジェットを埋め込む</h2>
            <p className="theme-text-secondary mb-4">
              このデータを外部サイトやブログに埋め込むことができます。以下のiframeコードをコピーしてください。
            </p>

            <div className="space-y-4">
              <div>
                <p className="theme-text mb-2 text-sm font-medium">概要統計（作品数・女優数）:</p>
                <code className="block overflow-x-auto rounded bg-gray-800 p-3 text-xs text-green-400">
                  {`<iframe src="${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/embed/stats?type=overview" width="320" height="180" frameborder="0"></iframe>`}
                </code>
              </div>

              <div>
                <p className="theme-text mb-2 text-sm font-medium">人気女優ランキング:</p>
                <code className="block overflow-x-auto rounded bg-gray-800 p-3 text-xs text-green-400">
                  {`<iframe src="${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/embed/stats?type=performers&limit=5" width="320" height="280" frameborder="0"></iframe>`}
                </code>
              </div>

              <div>
                <p className="theme-text mb-2 text-sm font-medium">人気ジャンル:</p>
                <code className="block overflow-x-auto rounded bg-gray-800 p-3 text-xs text-green-400">
                  {`<iframe src="${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/embed/stats?type=genres&limit=5" width="320" height="280" frameborder="0"></iframe>`}
                </code>
              </div>

              <div>
                <p className="theme-text mb-2 text-sm font-medium">月別リリース推移:</p>
                <code className="block overflow-x-auto rounded bg-gray-800 p-3 text-xs text-green-400">
                  {`<iframe src="${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/embed/stats?type=releases" width="320" height="200" frameborder="0"></iframe>`}
                </code>
              </div>
            </div>

            <div className="theme-content theme-border mt-4 rounded border p-3">
              <p className="theme-text mb-2 text-sm font-medium">パラメータ:</p>
              <ul className="theme-text-secondary space-y-1 text-xs">
                <li>
                  <code className="rounded bg-gray-100 px-1">theme=dark</code> - ダークテーマ
                </li>
                <li>
                  <code className="rounded bg-gray-100 px-1">limit=10</code> - 表示件数（最大10）
                </li>
              </ul>
            </div>
          </section>

          {/* データ出典・注意書き */}
          <section className="theme-content theme-border rounded-lg border p-6">
            <h2 className="theme-text mb-2 text-lg font-bold">データについて</h2>
            <ul className="theme-text-secondary space-y-1 text-sm">
              <li>• 統計データは毎日自動更新されます。</li>
              <li>• 作品数は当サイトに登録されている作品を対象としています。</li>
              <li>• 女優ランキングは出演作品数に基づいています。</li>
              <li>• このデータを引用する場合は、出典としてURLを記載してください。</li>
              <li>• ウィジェットの埋め込みは自由に行えます。</li>
            </ul>
          </section>
        </main>
      </section>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="theme-content theme-border rounded-lg border p-4 shadow-sm">
      <p className="theme-text-secondary mb-1 text-sm">{label}</p>
      <p className="text-2xl font-bold text-pink-600 md:text-3xl">
        {value}
        <span className="ml-1 text-sm font-normal text-gray-500">{suffix}</span>
      </p>
    </div>
  );
}
