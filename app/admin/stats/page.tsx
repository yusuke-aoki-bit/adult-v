'use client';

import { useEffect, useState } from 'react';

interface ASPSummary {
  asp_name: string;
  total_products: string;
  with_image: string;
  image_pct: string | null;
  with_video: string;
  video_pct: string | null;
  with_performer: string;
  performer_pct: string | null;
}

interface VideoStats {
  asp_name: string;
  total_videos: string;
  products_with_video: string;
}

interface PerformerStats {
  total_performers: string;
  with_image: string;
  with_wiki: string;
  with_products: string;
  total_aliases: string;
  total_links: string;
}

interface TotalStats {
  total_products: string;
  products_with_image: string;
  products_with_video: string;
  total_videos: string;
  products_with_performer: string;
}

interface TopPerformer {
  id: string;
  name: string;
  has_image: boolean;
  has_wiki: boolean;
  product_count: string;
}

interface StatsData {
  aspSummary: ASPSummary[];
  videoStats: VideoStats[];
  performerStats: PerformerStats;
  totalStats: TotalStats;
  topPerformers: TopPerformer[];
  noImagePerformers: { id: string; name: string; product_count: string }[];
  generatedAt: string;
}

function formatNumber(num: string | number): string {
  return Number(num).toLocaleString();
}

function getStatusIcon(pct: number | null): string {
  if (pct === null) return '❌';
  if (pct >= 95) return '✅';
  if (pct >= 70) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

function ProgressBar({ value, max = 100 }: { value: number | null; max?: number }) {
  const pct = value ?? 0;
  const width = Math.min((pct / max) * 100, 100);

  let bgColor = 'bg-red-500';
  if (pct >= 95) bgColor = 'bg-green-500';
  else if (pct >= 70) bgColor = 'bg-green-400';
  else if (pct >= 50) bgColor = 'bg-yellow-500';
  else if (pct >= 25) bgColor = 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${bgColor} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-12">{pct?.toFixed(1) ?? '0'}%</span>
    </div>
  );
}

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="text-red-500">Error: {error}</div>
        <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-blue-600 rounded">
          Retry
        </button>
      </div>
    );
  }

  const { aspSummary, videoStats, performerStats, totalStats, topPerformers, noImagePerformers, generatedAt } = data;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Data Collection Stats</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Generated: {new Date(generatedAt).toLocaleString('ja-JP')}
            </span>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Total Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{formatNumber(totalStats.total_products)}</div>
            <div className="text-sm text-gray-400">Total Products</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{formatNumber(totalStats.products_with_image)}</div>
            <div className="text-sm text-gray-400">With Image</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{formatNumber(totalStats.products_with_video)}</div>
            <div className="text-sm text-gray-400">With Video</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{formatNumber(totalStats.total_videos)}</div>
            <div className="text-sm text-gray-400">Total Videos</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-pink-400">{formatNumber(totalStats.products_with_performer)}</div>
            <div className="text-sm text-gray-400">With Performer</div>
          </div>
        </div>

        {/* ASP Summary Table */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">ASP Collection Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">ASP</th>
                  <th className="pb-3 pr-4 text-right">Products</th>
                  <th className="pb-3 pr-4">Image</th>
                  <th className="pb-3 pr-4">Video</th>
                  <th className="pb-3 pr-4">Performer</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {aspSummary.map((asp) => {
                  const imagePct = asp.image_pct ? parseFloat(asp.image_pct) : null;
                  const videoPct = asp.video_pct ? parseFloat(asp.video_pct) : null;
                  const performerPct = asp.performer_pct ? parseFloat(asp.performer_pct) : null;

                  return (
                    <tr key={asp.asp_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 pr-4 font-medium">{asp.asp_name}</td>
                      <td className="py-3 pr-4 text-right font-mono">{formatNumber(asp.total_products)}</td>
                      <td className="py-3 pr-4">
                        <ProgressBar value={imagePct} />
                      </td>
                      <td className="py-3 pr-4">
                        <ProgressBar value={videoPct} />
                      </td>
                      <td className="py-3 pr-4">
                        <ProgressBar value={performerPct} />
                      </td>
                      <td className="py-3">
                        <span className="text-lg">
                          {getStatusIcon(imagePct)}
                          {getStatusIcon(videoPct)}
                          {getStatusIcon(performerPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Video Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sample Videos by ASP</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">ASP</th>
                  <th className="pb-3 text-right">Videos</th>
                  <th className="pb-3 text-right">Products</th>
                  <th className="pb-3 text-right">Avg/Product</th>
                </tr>
              </thead>
              <tbody>
                {videoStats.map((v) => (
                  <tr key={v.asp_name} className="border-b border-gray-700/50">
                    <td className="py-2">{v.asp_name}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(v.total_videos)}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(v.products_with_video)}</td>
                    <td className="py-2 text-right font-mono">
                      {(parseInt(v.total_videos) / parseInt(v.products_with_video)).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performer Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Performer Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Performers</span>
                <span className="font-mono">{formatNumber(performerStats.total_performers)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">With Image</span>
                <span className="font-mono">
                  {formatNumber(performerStats.with_image)} (
                  {((parseInt(performerStats.with_image) / parseInt(performerStats.total_performers)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">With Wikipedia</span>
                <span className="font-mono">{formatNumber(performerStats.with_wiki)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">With Products</span>
                <span className="font-mono">{formatNumber(performerStats.with_products)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Aliases</span>
                <span className="font-mono">{formatNumber(performerStats.total_aliases)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Product-Performer Links</span>
                <span className="font-mono">{formatNumber(performerStats.total_links)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Performers */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Top 10 Performers</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">Name</th>
                  <th className="pb-3 text-center">Img</th>
                  <th className="pb-3 text-center">Wiki</th>
                  <th className="pb-3 text-right">Products</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-700/50">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-center">{p.has_image ? '✅' : '❌'}</td>
                    <td className="py-2 text-center">{p.has_wiki ? '✅' : '❌'}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(p.product_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* No Image Performers */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Missing Image (High Priority)</h2>
            <p className="text-xs text-gray-400 mb-3">Performers without images but with many products</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">Name</th>
                  <th className="pb-3 text-right">Products</th>
                </tr>
              </thead>
              <tbody>
                {noImagePerformers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-700/50">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(p.product_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 text-xs text-gray-500">
          <p>Status Icons: ✅ 95%+ | 🟢 70-95% | 🟡 50-70% | 🔴 &lt;50% | ❌ 0%</p>
        </div>
      </div>
    </div>
  );
}
