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

interface JobStatus {
  name: string;
  executionName: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'unknown';
  completedAt?: string;
  startedAt?: string;
  duration?: string;
  logsUrl?: string;
  consoleUrl?: string;
}

interface JobsData {
  jobs: JobStatus[];
  summary: {
    running: number;
    succeeded: number;
    failed: number;
    unknown: number;
  };
  generatedAt: string;
  error?: string;
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

interface CollectionRate {
  asp_name: string;
  collected: number;
  estimated: number | null;
  rate: string | null;
  source: string | null;
}

interface LatestRelease {
  asp_name: string;
  latest_release: string | null;
}

interface DailyCollection {
  date: string;
  asp_name: string;
  count: string;
}

interface RawDataCount {
  table_name: string;
  count: string;
}

interface ProductImageStat {
  image_type: string;
  asp_name: string;
  count: string;
  products: string;
}

interface ProductVideoTypeStat {
  video_type: string;
  quality: string;
  asp_name: string;
  count: string;
  products: string;
}

interface PerformerImageStat {
  image_type: string;
  source: string;
  count: string;
  performers: string;
  primary_count: string;
}

interface PerformerAliasStat {
  source: string;
  count: string;
  performers: string;
  primary_count: string;
}

interface PerformerExternalIdStat {
  provider: string;
  count: string;
  performers: string;
}

interface TagStat {
  category: string;
  tag_count: string;
  product_tag_links: string;
  products_with_tag: string;
}

interface TopTag {
  name: string;
  category: string | null;
  product_count: string;
}

interface ReviewStat {
  asp_name: string;
  review_count: string;
  products_reviewed: string;
  avg_rating: string | null;
}

interface RatingSummaryStat {
  asp_name: string;
  summary_count: string;
  avg_rating: string | null;
  total_reviews: string;
}

interface SalesStat {
  sale_type: string;
  count: string;
  active_count: string;
  avg_discount: string | null;
  min_discount: string | null;
  max_discount: string | null;
}

interface WikiCrawlStat {
  source: string;
  total_records: string;
  unique_products: string;
  unique_performers: string;
  processed_count: string;
}

interface WikiIndexStat {
  source: string;
  total_records: string;
  unique_product_codes: string;
  unique_performers: string;
  verified_count: string;
}

interface AIContentStat {
  table_name: string;
  total: string;
  with_ai_description: string;
  with_ai_tags: string;
  with_ai_review: string;
  with_ai_catchphrase: string;
}

interface PerformerAIStat {
  total_performers: string;
  with_ai_review: string;
  with_height: string;
  with_measurements: string;
  with_birthday: string;
  with_social: string;
}

interface TranslationStat {
  table_name: string;
  total: string;
  en: string;
  zh: string;
  zh_tw: string;
  ko: string;
}

interface PriceStat {
  currency: string;
  asp_name: string;
  count: string;
  min_price: string;
  max_price: string;
  avg_price: string;
}

interface TableRowCount {
  table_name: string;
  count: string;
}

interface StatsData {
  aspSummary: ASPSummary[];
  videoStats: VideoStats[];
  performerStats: PerformerStats;
  totalStats: TotalStats;
  topPerformers: TopPerformer[];
  noImagePerformers: { id: string; name: string; product_count: string }[];
  collectionRates: CollectionRate[];
  latestReleases: LatestRelease[];
  dailyCollection: DailyCollection[];
  rawDataCounts: RawDataCount[];
  // 新規追加
  productImageStats: ProductImageStat[];
  productVideoTypeStats: ProductVideoTypeStat[];
  performerImageStats: PerformerImageStat[];
  performerAliasStats: PerformerAliasStat[];
  performerExternalIdStats: PerformerExternalIdStat[];
  tagStats: TagStat[];
  topTags: TopTag[];
  reviewStats: ReviewStat[];
  ratingSummaryStats: RatingSummaryStat[];
  salesStats: SalesStat[];
  wikiCrawlStats: WikiCrawlStat[];
  wikiIndexStats: WikiIndexStat[];
  aiContentStats: AIContentStat[];
  performerAiStats: PerformerAIStat[];
  translationStats: TranslationStat[];
  priceStats: PriceStat[];
  tableRowCounts: TableRowCount[];
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

export default function AdminStatsContent() {
  const [data, setData] = useState<StatsData | null>(null);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, []);

  // Auto-refresh for jobs
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchJobs();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

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

  async function fetchJobs() {
    try {
      const res = await fetch('/api/admin/jobs');
      if (res.ok) {
        const json = await res.json();
        setJobsData(json);
      }
    } catch {
      // Jobs fetch is optional, don't show error
    }
  }

  function getJobStatusIcon(status: JobStatus['status']): string {
    switch (status) {
      case 'running': return '🔄';
      case 'succeeded': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  function getJobStatusClass(status: JobStatus['status']): string {
    switch (status) {
      case 'running': return 'text-blue-400';
      case 'succeeded': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
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

  const { aspSummary, videoStats, performerStats, totalStats, topPerformers, noImagePerformers, collectionRates, latestReleases, dailyCollection, rawDataCounts, generatedAt } = data;

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

        {/* Cloud Run Jobs Status */}
        {jobsData && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Crawler Jobs Status</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-400">🔄 Running: {jobsData.summary.running}</span>
                <span className="text-green-400">✅ Succeeded: {jobsData.summary.succeeded}</span>
                <span className="text-red-400">❌ Failed: {jobsData.summary.failed}</span>
                <div className="flex items-center gap-2 border-l border-gray-600 pl-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs">Auto</span>
                  </label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="bg-gray-700 text-xs rounded px-2 py-1"
                    disabled={!autoRefresh}
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
                <button
                  onClick={fetchJobs}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {jobsData.jobs.map((job) => {
                const isExpanded = expandedJob === job.name;
                return (
                  <div
                    key={job.name}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      job.status === 'running' ? 'bg-blue-900/30 border-blue-700' :
                      job.status === 'succeeded' ? 'bg-green-900/20 border-green-800' :
                      job.status === 'failed' ? 'bg-red-900/30 border-red-700' :
                      'bg-gray-700/30 border-gray-600'
                    } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setExpandedJob(isExpanded ? null : job.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getJobStatusIcon(job.status)}</span>
                        <span className={`text-sm font-medium ${getJobStatusClass(job.status)}`}>
                          {job.name.replace('-crawler', '')}
                        </span>
                        {job.status === 'running' && (
                          <span className="animate-pulse text-xs text-blue-400">(running)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {job.consoleUrl && (
                          <a
                            href={job.consoleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-blue-400 px-1"
                            title="Cloud Console"
                          >
                            Console
                          </a>
                        )}
                        {job.logsUrl && (
                          <a
                            href={job.logsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-blue-400 px-1"
                            title="View Logs"
                          >
                            Logs
                          </a>
                        )}
                      </div>
                    </div>
                    {/* Compact view - always shown */}
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                      {job.duration && (
                        <span title="Duration">{job.duration}</span>
                      )}
                      {job.completedAt && job.status !== 'running' && (
                        <span title="Completed">{new Date(job.completedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {job.status === 'running' && job.startedAt && (
                        <span title="Started">{new Date(job.startedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    {/* Expanded view */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-600 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-500">Execution ID:</div>
                          <div className="text-gray-400 font-mono truncate" title={job.executionName || undefined}>
                            {job.executionName || '-'}
                          </div>
                          <div className="text-gray-500">Duration:</div>
                          <div className="text-gray-400">{job.duration || '-'}</div>
                          <div className="text-gray-500">Started:</div>
                          <div className="text-gray-400">
                            {job.startedAt ? new Date(job.startedAt).toLocaleString('ja-JP') : '-'}
                          </div>
                          <div className="text-gray-500">Completed:</div>
                          <div className="text-gray-400">
                            {job.completedAt ? new Date(job.completedAt).toLocaleString('ja-JP') : (job.status === 'running' ? '(in progress)' : '-')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {jobsData.error && (
              <div className="mt-3 text-xs text-yellow-500">
                Note: Could not fetch live status from Cloud Run
              </div>
            )}
          </div>
        )}

        {/* Collection Rate Section - Most Important */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Collection Rate (vs Estimated Total)</h2>
          <p className="text-xs text-gray-500 mb-4">推定値は各ASPのAPI/サイトから動的に取得（1時間キャッシュ）</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">Provider</th>
                  <th className="pb-3 pr-4 text-right">Collected</th>
                  <th className="pb-3 pr-4 text-right">Estimated</th>
                  <th className="pb-3 pr-4">Rate</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3">Latest Release</th>
                </tr>
              </thead>
              <tbody>
                {collectionRates.map((rate) => {
                  const latest = latestReleases.find(l => l.asp_name === rate.asp_name);
                  const rateNum = rate.rate ? parseFloat(rate.rate) : 0;
                  const hasError = rate.estimated === null || rate.source?.includes('エラー');
                  return (
                    <tr key={rate.asp_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 pr-4 font-medium">{rate.asp_name}</td>
                      <td className="py-3 pr-4 text-right font-mono">{formatNumber(rate.collected)}</td>
                      <td className={`py-3 pr-4 text-right font-mono ${hasError ? 'text-red-400' : 'text-gray-400'}`}>
                        {rate.estimated ? formatNumber(rate.estimated) : (hasError ? 'エラー' : '-')}
                      </td>
                      <td className="py-3 pr-4">
                        {rate.rate && !hasError && <ProgressBar value={rateNum} />}
                        {hasError && <span className="text-red-400 text-xs">取得失敗</span>}
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-500 max-w-48 truncate" title={rate.source || undefined}>
                        {rate.source || '-'}
                      </td>
                      <td className="py-3 text-sm text-gray-400">
                        {latest?.latest_release
                          ? new Date(latest.latest_release).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

        {/* Daily Collection Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Collection Activity (14 days)</h2>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Provider</th>
                    <th className="pb-3 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCollection.slice(0, 30).map((d, i) => (
                    <tr key={`${d.date}-${d.asp_name}-${i}`} className="border-b border-gray-700/50">
                      <td className="py-2 text-gray-400">{d.date}</td>
                      <td className="py-2">{d.asp_name}</td>
                      <td className="py-2 text-right font-mono">{formatNumber(d.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Data Counts */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Raw Data Storage</h2>
            <div className="space-y-3">
              {rawDataCounts.map((r) => (
                <div key={r.table_name} className="flex justify-between items-center">
                  <span className="text-gray-400">{r.table_name}</span>
                  <span className="font-mono">{formatNumber(r.count)}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Raw Records</span>
                <span className="font-mono font-bold text-blue-400">
                  {formatNumber(rawDataCounts.reduce((sum, r) => sum + parseInt(r.count), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Database Table Row Counts */}
        {data.tableRowCounts && data.tableRowCounts.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Database Table Row Counts</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.tableRowCounts.map((t) => (
                <div key={t.table_name} className="bg-gray-700/50 rounded p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-300">{t.table_name}</span>
                  <span className="font-mono text-blue-400">{formatNumber(t.count)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
              <span className="text-gray-400">Total Records</span>
              <span className="font-mono font-bold text-green-400">
                {formatNumber(data.tableRowCounts.reduce((sum, t) => sum + parseInt(t.count), 0))}
              </span>
            </div>
          </div>
        )}

        {/* AI Content Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {data.aiContentStats && data.aiContentStats.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">AI Content (Products)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">Table</th>
                      <th className="pb-3 text-right">Total</th>
                      <th className="pb-3 text-right">AI Desc</th>
                      <th className="pb-3 text-right">AI Tags</th>
                      <th className="pb-3 text-right">AI Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aiContentStats.map((s) => (
                      <tr key={s.table_name} className="border-b border-gray-700/50">
                        <td className="py-2">{s.table_name}</td>
                        <td className="py-2 text-right font-mono">{formatNumber(s.total)}</td>
                        <td className="py-2 text-right font-mono text-green-400">{formatNumber(s.with_ai_description)}</td>
                        <td className="py-2 text-right font-mono text-blue-400">{formatNumber(s.with_ai_tags)}</td>
                        <td className="py-2 text-right font-mono text-purple-400">{formatNumber(s.with_ai_review)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.performerAiStats && data.performerAiStats.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">AI Content (Performers)</h2>
              <div className="space-y-3">
                {data.performerAiStats.map((s) => (
                  <div key="performer-ai" className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Performers</span>
                      <span className="font-mono">{formatNumber(s.total_performers)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">With AI Review</span>
                      <span className="font-mono text-purple-400">{formatNumber(s.with_ai_review)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">With Height</span>
                      <span className="font-mono">{formatNumber(s.with_height)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">With Measurements</span>
                      <span className="font-mono">{formatNumber(s.with_measurements)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">With Birthday</span>
                      <span className="font-mono">{formatNumber(s.with_birthday)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">With Social Links</span>
                      <span className="font-mono">{formatNumber(s.with_social)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Translation Statistics */}
        {data.translationStats && data.translationStats.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Translation Coverage</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3">Table</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3 text-right">EN</th>
                    <th className="pb-3 text-right">ZH</th>
                    <th className="pb-3 text-right">ZH-TW</th>
                    <th className="pb-3 text-right">KO</th>
                  </tr>
                </thead>
                <tbody>
                  {data.translationStats.map((s) => {
                    const total = parseInt(s.total);
                    const enPct = total > 0 ? ((parseInt(s.en) / total) * 100).toFixed(1) : '0';
                    const zhPct = total > 0 ? ((parseInt(s.zh) / total) * 100).toFixed(1) : '0';
                    const zhTwPct = total > 0 ? ((parseInt(s.zh_tw) / total) * 100).toFixed(1) : '0';
                    const koPct = total > 0 ? ((parseInt(s.ko) / total) * 100).toFixed(1) : '0';
                    return (
                      <tr key={s.table_name} className="border-b border-gray-700/50">
                        <td className="py-2">{s.table_name}</td>
                        <td className="py-2 text-right font-mono">{formatNumber(s.total)}</td>
                        <td className="py-2 text-right">
                          <span className="font-mono">{formatNumber(s.en)}</span>
                          <span className="text-xs text-gray-500 ml-1">({enPct}%)</span>
                        </td>
                        <td className="py-2 text-right">
                          <span className="font-mono">{formatNumber(s.zh)}</span>
                          <span className="text-xs text-gray-500 ml-1">({zhPct}%)</span>
                        </td>
                        <td className="py-2 text-right">
                          <span className="font-mono">{formatNumber(s.zh_tw)}</span>
                          <span className="text-xs text-gray-500 ml-1">({zhTwPct}%)</span>
                        </td>
                        <td className="py-2 text-right">
                          <span className="font-mono">{formatNumber(s.ko)}</span>
                          <span className="text-xs text-gray-500 ml-1">({koPct}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 text-xs text-gray-500">
          <p>Status Icons: ✅ 95%+ | 🟢 70-95% | 🟡 50-70% | 🔴 &lt;50% | ❌ 0%</p>
          <p className="mt-1">Collection Rate estimates are approximate based on known site catalog sizes.</p>
        </div>
      </div>
    </div>
  );
}
