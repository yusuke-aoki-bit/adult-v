'use client';

import { useEffect, useState } from 'react';

// Types
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

interface SchedulerStatus {
  name: string;
  schedule: string;
  timeZone: string;
  state: 'ENABLED' | 'PAUSED' | 'UNKNOWN';
  lastAttemptTime?: string;
  lastAttemptStatus?: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  nextRunTime?: string;
}

interface JobsData {
  jobs: JobStatus[];
  summary: {
    running: number;
    succeeded: number;
    failed: number;
    unknown: number;
  };
  schedulers?: SchedulerStatus[];
  schedulerSummary?: {
    enabled: number;
    paused: number;
    failed: number;
    succeeded: number;
  };
  generatedAt: string;
  error?: string;
}

interface SeoIndexingSummary {
  total_indexed: string;
  requested: string;
  pending: string;
  errors: string;
  ownership_required: string;
  last_requested_at: string | null;
  not_requested: string;
}

interface SeoIndexingByStatus {
  status: string;
  count: string;
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

interface TableRowCount {
  table_name: string;
  count: string;
}

interface DailyGrowth {
  table_name: string;
  today: string;
  yesterday: string;
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
  aiContentStats: AIContentStat[];
  performerAiStats: PerformerAIStat[];
  translationStats: TranslationStat[];
  tableRowCounts: TableRowCount[];
  dailyGrowth?: DailyGrowth[];
  seoIndexingByStatus?: SeoIndexingByStatus[];
  seoIndexingSummary?: SeoIndexingSummary | null;
  generatedAt: string;
}

// Props
export interface AdminStatsContentProps {
  /** ダークモード使用 */
  darkMode?: boolean;
  /** SEO Indexing統計を表示 */
  showSeoIndexing?: boolean;
  /** Scheduler統計を表示 */
  showSchedulers?: boolean;
}

// Utility functions
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

// Theme classes
const getThemeClasses = (darkMode: boolean) => ({
  bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
  text: darkMode ? 'text-white' : 'text-gray-800',
  textMuted: darkMode ? 'text-gray-400' : 'text-gray-500',
  textSecondary: darkMode ? 'text-gray-500' : 'text-gray-600',
  card: darkMode ? 'bg-gray-800' : 'bg-white shadow-sm border border-gray-200',
  cardInner: darkMode ? 'bg-gray-700/50' : 'bg-gray-50 border border-gray-100',
  border: darkMode ? 'border-gray-700' : 'border-gray-200',
  borderLight: darkMode ? 'border-gray-700/50' : 'border-gray-100',
  hoverBg: darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50',
  progressBg: darkMode ? 'bg-gray-700' : 'bg-gray-200',
  btnPrimary: darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-700 hover:bg-rose-800',
  btnSecondary: darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200 border border-gray-200',
  // Job status colors
  jobRunning: darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-300',
  jobSucceeded: darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-300',
  jobFailed: darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-300',
  jobUnknown: darkMode ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200',
  // Status text colors
  statusRunning: darkMode ? 'text-blue-400' : 'text-blue-600',
  statusSucceeded: darkMode ? 'text-green-400' : 'text-green-600',
  statusFailed: darkMode ? 'text-red-400' : 'text-red-600',
});

// ASP colors for chart
const ASP_COLORS: Record<string, string> = {
  'DUGA': '#f59e0b',      // amber
  'Sokmil': '#10b981',    // emerald
  'MGS': '#ef4444',       // red
  'FC2': '#3b82f6',       // blue
  'B10F': '#8b5cf6',      // violet
  'FANZA': '#ec4899',     // pink
  'DTI: Heyzo': '#06b6d4',// cyan
  'DTI: 1Pondo': '#14b8a6', // teal
  'DTI: Caribbean': '#84cc16', // lime
  'DTI: Caribbeancompr': '#22c55e', // green
  'Japanska': '#f97316',  // orange
  'Tokyohot': '#a855f7',  // purple
};

function getAspColor(aspName: string): string {
  // DTIサブサービスの特別処理
  if (aspName.startsWith('DTI:')) {
    return ASP_COLORS[aspName] || '#6b7280';
  }
  return ASP_COLORS[aspName] || '#6b7280';
}

// Collection Rate Donut Chart Component
function CollectionRateChart({ data, darkMode }: { data: CollectionRate[]; darkMode: boolean }) {
  const theme = getThemeClasses(darkMode);

  // 上位8件のみ表示
  const topData = data.slice(0, 8);
  const total = topData.reduce((sum, d) => sum + d.collected, 0);

  // 円グラフのパス生成
  let currentAngle = -90; // 12時方向から開始
  const radius = 80;
  const centerX = 100;
  const centerY = 100;

  const slices = topData.map((item, index) => {
    const percentage = (item.collected / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // パスの計算
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const color = getAspColor(item.asp_name);
    const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { path, color, asp: item.asp_name, collected: item.collected, percentage, index };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      {/* ドーナツチャート */}
      <div className="relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {slices.map((slice) => (
            <path
              key={slice.asp}
              d={slice.path}
              fill={slice.color}
              className="transition-opacity hover:opacity-80 cursor-pointer"
            >
              <title>{`${slice.asp}: ${slice.collected.toLocaleString()} (${slice.percentage.toFixed(1)}%)`}</title>
            </path>
          ))}
          {/* 中央の白い円（ドーナツ効果） */}
          <circle cx={centerX} cy={centerY} r="50" fill={darkMode ? '#1f2937' : '#ffffff'} />
          {/* 中央のテキスト */}
          <text x={centerX} y={centerY - 8} textAnchor="middle" className={`text-2xl font-bold ${theme.text}`} fill="currentColor">
            {(total / 1000).toFixed(0)}K
          </text>
          <text x={centerX} y={centerY + 12} textAnchor="middle" className={`text-xs ${theme.textMuted}`} fill="currentColor">
            Total
          </text>
        </svg>
      </div>

      {/* 凡例 */}
      <div className="grid grid-cols-2 gap-2">
        {topData.map((item) => (
          <div key={item.asp_name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: getAspColor(item.asp_name) }}
            />
            <div className="min-w-0">
              <div className={`text-xs font-medium truncate ${theme.text}`}>{item.asp_name}</div>
              <div className={`text-xs ${theme.textMuted}`}>
                {(item.collected / 1000).toFixed(1)}K
                {item.rate && <span className="ml-1">({parseFloat(item.rate).toFixed(0)}%)</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Content Progress Chart
function AIContentChart({ data, darkMode }: { data: AIContentStat[]; darkMode: boolean }) {
  const theme = getThemeClasses(darkMode);
  const stat = data[0];
  if (!stat) return null;

  const total = parseInt(stat.total);
  const metrics = [
    { label: 'AI Description', value: parseInt(stat.with_ai_description), color: '#3b82f6' },
    { label: 'AI Tags', value: parseInt(stat.with_ai_tags), color: '#10b981' },
    { label: 'AI Review', value: parseInt(stat.with_ai_review), color: '#f59e0b' },
    { label: 'AI Catchphrase', value: parseInt(stat.with_ai_catchphrase), color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-3">
      {metrics.map((m) => {
        const pct = total > 0 ? (m.value / total) * 100 : 0;
        return (
          <div key={m.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className={theme.textMuted}>{m.label}</span>
              <span className={theme.text}>{m.value.toLocaleString()} ({pct.toFixed(1)}%)</span>
            </div>
            <div className={`h-4 ${theme.progressBg} rounded-full overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all relative group"
                style={{ width: `${pct}%`, backgroundColor: m.color }}
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Translation Progress Chart
function TranslationChart({ data, darkMode }: { data: TranslationStat[]; darkMode: boolean }) {
  const theme = getThemeClasses(darkMode);

  const languages = [
    { code: 'en', label: 'English', color: '#3b82f6' },
    { code: 'zh', label: '简体中文', color: '#ef4444' },
    { code: 'zh_tw', label: '繁體中文', color: '#f97316' },
    { code: 'ko', label: '한국어', color: '#22c55e' },
  ];

  return (
    <div className="space-y-4">
      {data.map((table) => {
        const total = parseInt(table.total);
        return (
          <div key={table.table_name} className={`${theme.cardInner} rounded-lg p-3`}>
            <div className={`text-sm font-medium mb-2 ${theme.text}`}>{table.table_name}</div>
            <div className="flex gap-1">
              {languages.map((lang) => {
                const value = parseInt(table[lang.code as keyof TranslationStat] as string) || 0;
                const pct = total > 0 ? (value / total) * 100 : 0;
                return (
                  <div
                    key={lang.code}
                    className="flex-1 relative group"
                    title={`${lang.label}: ${value.toLocaleString()} (${pct.toFixed(1)}%)`}
                  >
                    <div className={`h-6 ${theme.progressBg} rounded overflow-hidden`}>
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: lang.color }}
                      />
                    </div>
                    <div className={`text-xs text-center mt-1 ${theme.textMuted}`}>
                      {lang.code.toUpperCase()}
                    </div>
                    {/* ホバー時のツールチップ */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {lang.label}: {pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Table Size Bar Chart
function TableSizeChart({ data, darkMode }: { data: TableRowCount[]; darkMode: boolean }) {
  const theme = getThemeClasses(darkMode);

  // 上位10件のみ表示
  const topData = data.slice(0, 10);
  const maxCount = Math.max(...topData.map((t) => parseInt(t.count)));

  // テーブル名に応じた色
  const getTableColor = (name: string): string => {
    if (name.includes('product_images')) return '#f59e0b';
    if (name.includes('product_tags')) return '#3b82f6';
    if (name.includes('products')) return '#ef4444';
    if (name.includes('performer')) return '#ec4899';
    if (name.includes('video')) return '#8b5cf6';
    if (name.includes('wiki')) return '#06b6d4';
    if (name.includes('tag')) return '#22c55e';
    return '#6b7280';
  };

  return (
    <div className="space-y-2">
      {topData.map((table) => {
        const count = parseInt(table.count);
        const pct = (count / maxCount) * 100;
        return (
          <div key={table.table_name} className="flex items-center gap-2">
            <div className={`w-36 text-xs ${theme.textMuted} truncate shrink-0`} title={table.table_name}>
              {table.table_name}
            </div>
            <div className={`flex-1 h-5 ${theme.progressBg} rounded overflow-hidden relative group`}>
              <div
                className="h-full rounded transition-all"
                style={{ width: `${pct}%`, backgroundColor: getTableColor(table.table_name) }}
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <span className={`text-xs font-mono ${theme.text}`}>
                  {count >= 1000000 ? `${(count / 1000000).toFixed(1)}M` : count >= 1000 ? `${(count / 1000).toFixed(0)}K` : count}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Daily Collection Chart Component
function DailyCollectionChart({ data, darkMode }: { data: DailyCollection[]; darkMode: boolean }) {
  const theme = getThemeClasses(darkMode);

  // データを日付ごとにグループ化
  const dateMap = new Map<string, Map<string, number>>();
  const aspSet = new Set<string>();

  data.forEach((item) => {
    const date = item.date.split('T')[0] || item.date;
    aspSet.add(item.asp_name);
    if (!dateMap.has(date)) {
      dateMap.set(date, new Map());
    }
    dateMap.get(date)!.set(item.asp_name, parseInt(item.count) || 0);
  });

  // 日付を昇順にソート
  const dates = Array.from(dateMap.keys()).sort();
  const asps = Array.from(aspSet).sort();

  // 各日付の合計を計算して最大値を求める
  let maxTotal = 0;
  const dateTotals = dates.map((date) => {
    const aspData = dateMap.get(date)!;
    let total = 0;
    asps.forEach((asp) => {
      total += aspData.get(asp) || 0;
    });
    maxTotal = Math.max(maxTotal, total);
    return { date, total, aspData };
  });

  // スケールを計算（最大値の110%を上限に）
  const scale = maxTotal > 0 ? maxTotal * 1.1 : 100;

  return (
    <div className="space-y-4">
      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 mb-4">
        {asps.map((asp) => (
          <div key={asp} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getAspColor(asp) }}
            />
            <span className={theme.textMuted}>{asp}</span>
          </div>
        ))}
      </div>

      {/* チャート */}
      <div className="space-y-2">
        {dateTotals.map(({ date, total, aspData }) => {
          const shortDate = date.slice(5); // MM-DD形式
          return (
            <div key={date} className="flex items-center gap-2">
              <div className={`w-16 text-xs ${theme.textMuted} text-right shrink-0`}>
                {shortDate}
              </div>
              <div className={`flex-1 h-6 ${theme.progressBg} rounded overflow-hidden flex`}>
                {asps.map((asp) => {
                  const count = aspData.get(asp) || 0;
                  const width = (count / scale) * 100;
                  if (width < 0.5) return null;
                  return (
                    <div
                      key={asp}
                      className="h-full transition-all relative group"
                      style={{
                        width: `${width}%`,
                        backgroundColor: getAspColor(asp),
                      }}
                      title={`${asp}: ${count.toLocaleString()}`}
                    >
                      {/* ホバー時にツールチップ表示 */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {asp}: {count.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`w-16 text-xs ${theme.textMuted} text-right shrink-0`}>
                {total.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* サマリー */}
      <div className={`mt-4 pt-4 border-t ${theme.border}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {asps.slice(0, 12).map((asp) => {
            const totalForAsp = dateTotals.reduce(
              (sum, { aspData }) => sum + (aspData.get(asp) || 0),
              0
            );
            return (
              <div
                key={asp}
                className={`${theme.cardInner} rounded p-2 text-center`}
              >
                <div
                  className="text-xs font-medium truncate"
                  style={{ color: getAspColor(asp) }}
                >
                  {asp}
                </div>
                <div className="text-sm font-bold">{totalForAsp.toLocaleString()}</div>
                <div className={`text-xs ${theme.textMuted}`}>14d total</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, darkMode = false }: { value: number | null; max?: number; darkMode?: boolean }) {
  const pct = value ?? 0;
  const width = Math.min((pct / max) * 100, 100);
  const theme = getThemeClasses(darkMode);

  let bgColor = 'bg-red-500';
  if (pct >= 95) bgColor = 'bg-green-500';
  else if (pct >= 70) bgColor = 'bg-green-400';
  else if (pct >= 50) bgColor = 'bg-yellow-500';
  else if (pct >= 25) bgColor = 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-24 h-2 ${theme.progressBg} rounded-full overflow-hidden`}>
        <div className={`h-full ${bgColor} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-xs ${theme.textMuted} w-12`}>{pct?.toFixed(1) ?? '0'}%</span>
    </div>
  );
}

export default function AdminStatsContent({
  darkMode = false,
  showSeoIndexing = false,
  showSchedulers = false,
}: AdminStatsContentProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const theme = getThemeClasses(darkMode);

  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, []);

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
      // Jobs fetch is optional
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
      case 'running': return theme.statusRunning;
      case 'succeeded': return theme.statusSucceeded;
      case 'failed': return theme.statusFailed;
      default: return theme.textMuted;
    }
  }

  function getJobBgClass(status: JobStatus['status']): string {
    switch (status) {
      case 'running': return theme.jobRunning;
      case 'succeeded': return theme.jobSucceeded;
      case 'failed': return theme.jobFailed;
      default: return theme.jobUnknown;
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} p-8 flex items-center justify-center`}>
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} p-8`}>
        <div className={theme.statusFailed}>Error: {error}</div>
        <button onClick={fetchStats} className={`mt-4 px-4 py-2 ${theme.btnPrimary} text-white rounded`}>
          Retry
        </button>
      </div>
    );
  }

  const { aspSummary, videoStats, performerStats, totalStats, topPerformers, noImagePerformers, collectionRates, latestReleases, dailyCollection, rawDataCounts, dailyGrowth, generatedAt } = data;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} p-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Data Collection Stats</h1>
          <div className="flex items-center gap-4">
            <span className={`text-sm ${theme.textMuted}`}>
              Generated: {new Date(generatedAt).toLocaleString('ja-JP')}
            </span>
            <button
              onClick={fetchStats}
              className={`px-4 py-2 ${theme.btnPrimary} text-white rounded text-sm`}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Total Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className={`${theme.card} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-blue-400">{formatNumber(totalStats.total_products)}</div>
            <div className={`text-sm ${theme.textMuted}`}>Total Products</div>
          </div>
          <div className={`${theme.card} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-green-400">{formatNumber(totalStats.products_with_image)}</div>
            <div className={`text-sm ${theme.textMuted}`}>With Image</div>
          </div>
          <div className={`${theme.card} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-purple-400">{formatNumber(totalStats.products_with_video)}</div>
            <div className={`text-sm ${theme.textMuted}`}>With Video</div>
          </div>
          <div className={`${theme.card} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-yellow-400">{formatNumber(totalStats.total_videos)}</div>
            <div className={`text-sm ${theme.textMuted}`}>Total Videos</div>
          </div>
          <div className={`${theme.card} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-pink-400">{formatNumber(totalStats.products_with_performer)}</div>
            <div className={`text-sm ${theme.textMuted}`}>With Performer</div>
          </div>
        </div>

        {/* Daily Growth Stats */}
        {dailyGrowth && dailyGrowth.length > 0 && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <h2 className="text-xl font-semibold mb-4">Daily Growth (Today vs Yesterday)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dailyGrowth.map((item) => {
                const today = parseInt(item.today) || 0;
                const yesterday = parseInt(item.yesterday) || 0;
                const isActiveSales = item.table_name === 'product_sales_active';
                return (
                  <div key={item.table_name} className={`${theme.cardInner} rounded-lg p-4`}>
                    <div className="text-sm font-medium mb-2">
                      {item.table_name === 'products' ? 'Products' :
                       item.table_name === 'product_sources' ? 'Sources' :
                       item.table_name === 'performers' ? 'Performers' :
                       item.table_name === 'product_sales_active' ? 'Active Sales' :
                       item.table_name}
                    </div>
                    {isActiveSales ? (
                      <div className="text-2xl font-bold text-orange-400">{formatNumber(today)}</div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-400">+{formatNumber(today)}</span>
                        <span className={`text-sm ${theme.textMuted}`}>today</span>
                      </div>
                    )}
                    {!isActiveSales && (
                      <div className={`text-sm ${theme.textMuted}`}>
                        Yesterday: +{formatNumber(yesterday)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Collection Chart - 過去14日間のASP別収集推移 */}
        {dailyCollection && dailyCollection.length > 0 && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <h2 className="text-xl font-semibold mb-4">Daily Collection Trend (Last 14 Days)</h2>
            <DailyCollectionChart data={dailyCollection} darkMode={darkMode} />
          </div>
        )}

        {/* Cloud Run Jobs Status */}
        {jobsData && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Crawler Jobs Status</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className={theme.statusRunning}>🔄 Running: {jobsData.summary.running}</span>
                <span className={theme.statusSucceeded}>✅ Succeeded: {jobsData.summary.succeeded}</span>
                <span className={theme.statusFailed}>❌ Failed: {jobsData.summary.failed}</span>
                <div className={`flex items-center gap-2 border-l ${theme.border} pl-4`}>
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
                    className={`${theme.btnSecondary} text-xs rounded px-2 py-1`}
                    disabled={!autoRefresh}
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
                <button
                  onClick={fetchJobs}
                  className={`px-3 py-1 ${theme.btnSecondary} rounded text-xs`}
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
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${getJobBgClass(job.status)} ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setExpandedJob(isExpanded ? null : job.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getJobStatusIcon(job.status)}</span>
                        <span className={`text-sm font-medium ${getJobStatusClass(job.status)}`}>
                          {job.name.replace('-crawler', '')}
                        </span>
                        {job.status === 'running' && (
                          <span className={`animate-pulse text-xs ${theme.statusRunning}`}>(running)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {job.consoleUrl && (
                          <a
                            href={job.consoleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs ${theme.textMuted} hover:text-blue-400 px-1`}
                          >
                            Console
                          </a>
                        )}
                        {job.logsUrl && (
                          <a
                            href={job.logsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs ${theme.textMuted} hover:text-blue-400 px-1`}
                          >
                            Logs
                          </a>
                        )}
                      </div>
                    </div>
                    <div className={`mt-2 text-xs ${theme.textSecondary} flex items-center gap-3`}>
                      {job.duration && <span title="Duration">{job.duration}</span>}
                      {job.completedAt && job.status !== 'running' && (
                        <span title="Completed">{new Date(job.completedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {job.status === 'running' && job.startedAt && (
                        <span title="Started">{new Date(job.startedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className={`mt-3 pt-3 border-t ${theme.border} text-xs space-y-2`}>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={theme.textSecondary}>Execution ID:</div>
                          <div className={`${theme.textMuted} font-mono truncate`} title={job.executionName || undefined}>
                            {job.executionName || '-'}
                          </div>
                          <div className={theme.textSecondary}>Duration:</div>
                          <div className={theme.textMuted}>{job.duration || '-'}</div>
                          <div className={theme.textSecondary}>Started:</div>
                          <div className={theme.textMuted}>
                            {job.startedAt ? new Date(job.startedAt).toLocaleString('ja-JP') : '-'}
                          </div>
                          <div className={theme.textSecondary}>Completed:</div>
                          <div className={theme.textMuted}>
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

        {/* Scheduler Status */}
        {showSchedulers && jobsData?.schedulers && jobsData.schedulers.length > 0 && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Scheduler Status</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className={theme.statusSucceeded}>Enabled: {jobsData.schedulerSummary?.enabled || 0}</span>
                <span className="text-yellow-400">Paused: {jobsData.schedulerSummary?.paused || 0}</span>
                <span className={theme.statusFailed}>Failed: {jobsData.schedulerSummary?.failed || 0}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Schedule</th>
                    <th className="pb-3 pr-4">State</th>
                    <th className="pb-3 pr-4">Last Run</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Next Run</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsData.schedulers.map((s) => (
                    <tr key={s.name} className={`border-b ${theme.borderLight} ${theme.hoverBg}`}>
                      <td className="py-2 pr-4 font-medium">{s.name}</td>
                      <td className={`py-2 pr-4 ${theme.textMuted} font-mono text-xs`}>{s.schedule}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          s.state === 'ENABLED' ? 'bg-green-900/50 text-green-400' :
                          s.state === 'PAUSED' ? 'bg-yellow-900/50 text-yellow-400' :
                          `${theme.cardInner} ${theme.textMuted}`
                        }`}>
                          {s.state}
                        </span>
                      </td>
                      <td className={`py-2 pr-4 ${theme.textSecondary} text-xs`}>
                        {s.lastAttemptTime ? new Date(s.lastAttemptTime).toLocaleString('ja-JP', {
                          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="py-2 pr-4">
                        {s.lastAttemptStatus === 'SUCCEEDED' && <span className={theme.statusSucceeded}>✅</span>}
                        {s.lastAttemptStatus === 'FAILED' && <span className={theme.statusFailed}>❌</span>}
                        {s.lastAttemptStatus === 'UNKNOWN' && <span className={theme.textMuted}>-</span>}
                      </td>
                      <td className={`py-2 ${theme.textSecondary} text-xs`}>
                        {s.nextRunTime ? new Date(s.nextRunTime).toLocaleString('ja-JP', {
                          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEO Indexing Status */}
        {showSeoIndexing && data['seoIndexingSummary'] && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <h2 className="text-xl font-semibold mb-4">SEO Indexing Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-4">
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className="text-2xl font-bold text-blue-400">{formatNumber(data['seoIndexingSummary'].total_indexed)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Total Indexed</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className="text-2xl font-bold text-green-400">{formatNumber(data['seoIndexingSummary'].requested)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Requested</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className="text-2xl font-bold text-yellow-400">{formatNumber(data['seoIndexingSummary'].pending)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Pending</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className="text-2xl font-bold text-red-400">{formatNumber(data['seoIndexingSummary'].errors)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Errors</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className="text-2xl font-bold text-orange-400">{formatNumber(data['seoIndexingSummary'].ownership_required)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Ownership Required</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className={`text-2xl font-bold ${theme.textMuted}`}>{formatNumber(data['seoIndexingSummary'].not_requested)}</div>
                <div className={`text-xs ${theme.textMuted}`}>Not Requested</div>
              </div>
              <div className={`${theme.cardInner} rounded p-3`}>
                <div className={`text-sm font-mono ${theme.text}`}>
                  {data['seoIndexingSummary'].last_requested_at
                    ? new Date(data['seoIndexingSummary'].last_requested_at).toLocaleString('ja-JP', {
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : '-'}
                </div>
                <div className={`text-xs ${theme.textMuted}`}>Last Request</div>
              </div>
            </div>
            {data['seoIndexingByStatus'] && data['seoIndexingByStatus'].length > 0 && (
              <div className="mt-4">
                <h3 className={`text-sm font-medium ${theme.textMuted} mb-2`}>By Status</h3>
                <div className="flex flex-wrap gap-2">
                  {data['seoIndexingByStatus'].map((s) => (
                    <div key={s.status} className={`${theme.cardInner} rounded px-3 py-1 text-sm`}>
                      <span className={theme.textMuted}>{s.status}:</span>
                      <span className="ml-1 font-mono">{formatNumber(s.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collection Rate Section */}
        <div className={`${theme.card} rounded-lg p-6 mb-8`}>
          <h2 className="text-xl font-semibold mb-4">Collection Rate (vs Estimated Total)</h2>
          <p className={`text-xs ${theme.textSecondary} mb-4`}>推定値は各ASPのAPI/サイトから動的に取得（1時間キャッシュ）</p>

          {/* ドーナツチャート */}
          <div className="mb-6">
            <CollectionRateChart data={collectionRates} darkMode={darkMode} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
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
                    <tr key={rate.asp_name} className={`border-b ${theme.borderLight} ${theme.hoverBg}`}>
                      <td className="py-3 pr-4 font-medium">{rate.asp_name}</td>
                      <td className="py-3 pr-4 text-right font-mono">{formatNumber(rate.collected)}</td>
                      <td className={`py-3 pr-4 text-right font-mono ${hasError ? 'text-red-400' : theme.textMuted}`}>
                        {rate.estimated ? formatNumber(rate.estimated) : (hasError ? 'エラー' : '-')}
                      </td>
                      <td className="py-3 pr-4">
                        {rate.rate && !hasError && <ProgressBar value={rateNum} darkMode={darkMode} />}
                        {hasError && <span className="text-red-400 text-xs">取得失敗</span>}
                      </td>
                      <td className={`py-3 pr-4 text-xs ${theme.textSecondary} max-w-48 truncate`} title={rate.source || undefined}>
                        {rate.source || '-'}
                      </td>
                      <td className={`py-3 text-sm ${theme.textMuted}`}>
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
        <div className={`${theme.card} rounded-lg p-6 mb-8`}>
          <h2 className="text-xl font-semibold mb-4">ASP Collection Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
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
                    <tr key={asp.asp_name} className={`border-b ${theme.borderLight} ${theme.hoverBg}`}>
                      <td className="py-3 pr-4 font-medium">{asp.asp_name}</td>
                      <td className="py-3 pr-4 text-right font-mono">{formatNumber(asp.total_products)}</td>
                      <td className="py-3 pr-4"><ProgressBar value={imagePct} darkMode={darkMode} /></td>
                      <td className="py-3 pr-4"><ProgressBar value={videoPct} darkMode={darkMode} /></td>
                      <td className="py-3 pr-4"><ProgressBar value={performerPct} darkMode={darkMode} /></td>
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

        {/* Video Stats & Performer Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Sample Videos by ASP</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
                  <th className="pb-3">ASP</th>
                  <th className="pb-3 text-right">Videos</th>
                  <th className="pb-3 text-right">Products</th>
                  <th className="pb-3 text-right">Avg/Product</th>
                </tr>
              </thead>
              <tbody>
                {videoStats.map((v) => (
                  <tr key={v.asp_name} className={`border-b ${theme.borderLight}`}>
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

          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Performer Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className={theme.textMuted}>Total Performers</span>
                <span className="font-mono">{formatNumber(performerStats.total_performers)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>With Image</span>
                <span className="font-mono">
                  {formatNumber(performerStats.with_image)} (
                  {((parseInt(performerStats.with_image) / parseInt(performerStats.total_performers)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>With Wikipedia</span>
                <span className="font-mono">{formatNumber(performerStats.with_wiki)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>With Products</span>
                <span className="font-mono">{formatNumber(performerStats.with_products)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Total Aliases</span>
                <span className="font-mono">{formatNumber(performerStats.total_aliases)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Product-Performer Links</span>
                <span className="font-mono">{formatNumber(performerStats.total_links)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performers & No Image */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Top 10 Performers</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
                  <th className="pb-3">Name</th>
                  <th className="pb-3 text-center">Img</th>
                  <th className="pb-3 text-center">Wiki</th>
                  <th className="pb-3 text-right">Products</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((p) => (
                  <tr key={p.id} className={`border-b ${theme.borderLight}`}>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-center">{p.has_image ? '✅' : '❌'}</td>
                    <td className="py-2 text-center">{p.has_wiki ? '✅' : '❌'}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(p.product_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Missing Image (High Priority)</h2>
            <p className={`text-xs ${theme.textMuted} mb-3`}>Performers without images but with many products</p>
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
                  <th className="pb-3">Name</th>
                  <th className="pb-3 text-right">Products</th>
                </tr>
              </thead>
              <tbody>
                {noImagePerformers.map((p) => (
                  <tr key={p.id} className={`border-b ${theme.borderLight}`}>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(p.product_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Collection & Raw Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Recent Collection Activity (14 days)</h2>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <tr className={`text-left ${theme.textMuted} border-b ${theme.border}`}>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Provider</th>
                    <th className="pb-3 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCollection.slice(0, 30).map((d, i) => (
                    <tr key={`${d.date}-${d.asp_name}-${i}`} className={`border-b ${theme.borderLight}`}>
                      <td className={`py-2 ${theme.textMuted}`}>{d.date}</td>
                      <td className="py-2">{d.asp_name}</td>
                      <td className="py-2 text-right font-mono">{formatNumber(d.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${theme.card} rounded-lg p-6`}>
            <h2 className="text-xl font-semibold mb-4">Raw Data Storage</h2>
            <div className="space-y-3">
              {rawDataCounts.map((r) => (
                <div key={r.table_name} className="flex justify-between items-center">
                  <span className={theme.textMuted}>{r.table_name}</span>
                  <span className="font-mono">{formatNumber(r.count)}</span>
                </div>
              ))}
            </div>
            <div className={`mt-6 pt-4 border-t ${theme.border}`}>
              <div className="flex justify-between items-center">
                <span className={theme.textMuted}>Total Raw Records</span>
                <span className="font-mono font-bold text-blue-400">
                  {formatNumber(rawDataCounts.reduce((sum, r) => sum + parseInt(r.count), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Row Counts */}
        {data.tableRowCounts && data.tableRowCounts.length > 0 && (
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <h2 className="text-xl font-semibold mb-4">Database Table Sizes</h2>

            {/* 棒グラフ */}
            <TableSizeChart data={data.tableRowCounts} darkMode={darkMode} />

            <div className={`mt-4 pt-4 border-t ${theme.border} flex justify-between`}>
              <span className={theme.textMuted}>Total Records</span>
              <span className="font-mono font-bold text-green-400">
                {formatNumber(data.tableRowCounts.reduce((sum, t) => sum + parseInt(t.count), 0))}
              </span>
            </div>
          </div>
        )}

        {/* AI Content Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {data.aiContentStats && data.aiContentStats.length > 0 && (
            <div className={`${theme.card} rounded-lg p-6`}>
              <h2 className="text-xl font-semibold mb-4">AI Content Progress</h2>
              <AIContentChart data={data.aiContentStats} darkMode={darkMode} />
            </div>
          )}

          {data.performerAiStats && data.performerAiStats.length > 0 && (
            <div className={`${theme.card} rounded-lg p-6`}>
              <h2 className="text-xl font-semibold mb-4">AI Content (Performers)</h2>
              <div className="space-y-3">
                {data.performerAiStats.map((s) => (
                  <div key="performer-ai" className="space-y-2">
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>Total Performers</span>
                      <span className="font-mono">{formatNumber(s.total_performers)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>With AI Review</span>
                      <span className="font-mono text-purple-400">{formatNumber(s.with_ai_review)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>With Height</span>
                      <span className="font-mono">{formatNumber(s.with_height)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>With Measurements</span>
                      <span className="font-mono">{formatNumber(s.with_measurements)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>With Birthday</span>
                      <span className="font-mono">{formatNumber(s.with_birthday)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme.textMuted}>With Social Links</span>
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
          <div className={`${theme.card} rounded-lg p-6 mb-8`}>
            <h2 className="text-xl font-semibold mb-4">Translation Coverage</h2>
            <TranslationChart data={data.translationStats} darkMode={darkMode} />
          </div>
        )}

        {/* Legend */}
        <div className={`mt-8 text-xs ${theme.textSecondary}`}>
          <p>Status Icons: ✅ 95%+ | 🟢 70-95% | 🟡 50-70% | 🔴 &lt;50% | ❌ 0%</p>
          <p className="mt-1">Collection Rate estimates are approximate based on known site catalog sizes.</p>
        </div>
      </div>
    </div>
  );
}
