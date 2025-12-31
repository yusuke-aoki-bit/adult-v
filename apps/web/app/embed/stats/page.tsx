/**
 * 埋め込みウィジェットページ
 * iframeで外部サイトから埋め込み可能
 */

import { Suspense } from 'react';
import {
  getOverallStats,
  getTopPerformersByProductCount,
  getTopGenres,
  getMonthlyReleaseStats,
} from '@adult-v/shared/db-queries';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1時間キャッシュ

// X-Frame-Optionsを許可するためのヘッダー設定
export async function generateMetadata() {
  return {
    other: {
      'X-Frame-Options': 'ALLOWALL',
    },
  };
}

interface WidgetProps {
  searchParams: Promise<{
    type?: string;
    theme?: string;
    limit?: string;
  }>;
}

async function OverviewWidget({ theme }: { theme: string }) {
  const stats = await getOverallStats();
  const isDark = theme === 'dark';

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <h3 className="text-lg font-bold mb-4">AV業界統計</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <p className="text-2xl font-bold text-indigo-500">{stats.totalProducts.toLocaleString()}</p>
          <p className="text-xs text-gray-500">作品数</p>
        </div>
        <div className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <p className="text-2xl font-bold text-pink-500">{stats.totalPerformers.toLocaleString()}</p>
          <p className="text-xs text-gray-500">女優数</p>
        </div>
        <div className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <p className="text-2xl font-bold text-purple-500">{stats.totalGenres.toLocaleString()}</p>
          <p className="text-xs text-gray-500">ジャンル</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        Powered by <a href={process.env.NEXT_PUBLIC_SITE_URL || '/'} target="_blank" rel="noopener" className="underline">Adult Viewer Lab</a>
      </p>
    </div>
  );
}

async function TopPerformersWidget({ theme, limit }: { theme: string; limit: number }) {
  const performers = await getTopPerformersByProductCount(limit);
  const isDark = theme === 'dark';

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <h3 className="text-lg font-bold mb-3">人気女優ランキング</h3>
      <ol className="space-y-2">
        {performers.slice(0, limit).map((performer, index) => (
          <li key={performer.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                index < 3 ? 'bg-yellow-500 text-white' : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                {index + 1}
              </span>
              <span className="text-sm truncate">{performer.name}</span>
            </div>
            <span className="text-xs text-gray-500">{performer.productCount}作品</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-400 mt-3 text-center">
        Powered by <a href={process.env.NEXT_PUBLIC_SITE_URL || '/'} target="_blank" rel="noopener" className="underline">Adult Viewer Lab</a>
      </p>
    </div>
  );
}

async function TopGenresWidget({ theme, limit }: { theme: string; limit: number }) {
  const genres = await getTopGenres(limit);
  const isDark = theme === 'dark';
  const maxCount = genres[0]?.productCount || 1;

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <h3 className="text-lg font-bold mb-3">人気ジャンルTOP{limit}</h3>
      <div className="space-y-2">
        {genres.slice(0, limit).map((genre) => (
          <div key={genre.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="truncate">{genre.name}</span>
              <span className="text-gray-500">{genre.productCount.toLocaleString()}</span>
            </div>
            <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                style={{ width: `${(genre.productCount / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        Powered by <a href={process.env.NEXT_PUBLIC_SITE_URL || '/'} target="_blank" rel="noopener" className="underline">Adult Viewer Lab</a>
      </p>
    </div>
  );
}

async function MonthlyReleasesWidget({ theme }: { theme: string }) {
  const releases = await getMonthlyReleaseStats(6);
  const isDark = theme === 'dark';
  const maxCount = Math.max(...releases.map(r => r.releaseCount)) || 1;

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <h3 className="text-lg font-bold mb-3">月別リリース数推移</h3>
      <div className="flex items-end justify-between h-24 gap-1">
        {releases.map((month) => (
          <div key={month.month} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t"
              style={{ height: `${(month.releaseCount / maxCount) * 100}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-gray-500 mt-1">{month.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        Powered by <a href={process.env.NEXT_PUBLIC_SITE_URL || '/'} target="_blank" rel="noopener" className="underline">Adult Viewer Lab</a>
      </p>
    </div>
  );
}

function LoadingWidget() {
  return (
    <div className="p-4 rounded-lg bg-gray-100 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

export default async function EmbedStatsPage({ searchParams }: WidgetProps) {
  const params = await searchParams;
  const type = params.type || 'overview';
  const theme = params.theme || 'light';
  const limit = Math.min(parseInt(params.limit || '5', 10), 10);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .bg-gray-800 { background-color: #1f2937; }
          .bg-gray-700 { background-color: #374151; }
          .bg-gray-200 { background-color: #e5e7eb; }
          .bg-gray-100 { background-color: #f3f4f6; }
          .bg-white { background-color: #fff; }
          .text-white { color: #fff; }
          .text-gray-900 { color: #111827; }
          .text-gray-500 { color: #6b7280; }
          .text-gray-400 { color: #9ca3af; }
          .text-indigo-500 { color: #6366f1; }
          .text-pink-500 { color: #ec4899; }
          .text-purple-500 { color: #a855f7; }
          .bg-yellow-500 { background-color: #eab308; }
          .rounded-lg { border-radius: 0.5rem; }
          .rounded-full { border-radius: 9999px; }
          .rounded { border-radius: 0.25rem; }
          .rounded-t { border-top-left-radius: 0.25rem; border-top-right-radius: 0.25rem; }
          .p-3 { padding: 0.75rem; }
          .p-4 { padding: 1rem; }
          .mb-1 { margin-bottom: 0.25rem; }
          .mb-3 { margin-bottom: 0.75rem; }
          .mb-4 { margin-bottom: 1rem; }
          .mt-1 { margin-top: 0.25rem; }
          .mt-3 { margin-top: 0.75rem; }
          .gap-1 { gap: 0.25rem; }
          .gap-2 { gap: 0.5rem; }
          .text-xs { font-size: 0.75rem; }
          .text-sm { font-size: 0.875rem; }
          .text-lg { font-size: 1.125rem; }
          .text-2xl { font-size: 1.5rem; }
          .font-bold { font-weight: 700; }
          .text-center { text-align: center; }
          .underline { text-decoration: underline; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .flex { display: flex; }
          .flex-1 { flex: 1 1 0%; }
          .flex-col { flex-direction: column; }
          .items-center { align-items: center; }
          .items-end { align-items: flex-end; }
          .justify-between { justify-content: space-between; }
          .grid { display: grid; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .space-y-2 > * + * { margin-top: 0.5rem; }
          .h-2 { height: 0.5rem; }
          .h-6 { height: 1.5rem; }
          .h-24 { height: 6rem; }
          .w-6 { width: 1.5rem; }
          .w-full { width: 100%; }
          .bg-gradient-to-r { background: linear-gradient(to right, #6366f1, #a855f7); }
          .bg-gradient-to-t { background: linear-gradient(to top, #6366f1, #a855f7); }
          ol { list-style: none; }
        `}</style>
      </head>
      <body>
        <Suspense fallback={<LoadingWidget />}>
          {type === 'overview' && <OverviewWidget theme={theme} />}
          {type === 'performers' && <TopPerformersWidget theme={theme} limit={limit} />}
          {type === 'genres' && <TopGenresWidget theme={theme} limit={limit} />}
          {type === 'releases' && <MonthlyReleasesWidget theme={theme} />}
        </Suspense>
      </body>
    </html>
  );
}
