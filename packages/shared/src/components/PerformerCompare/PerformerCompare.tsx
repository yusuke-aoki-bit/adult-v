'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// レーダーチャート用ヘルパー関数
function getRadarPoints(cx: number, cy: number, r: number, sides: number): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

function getRadarDataPoints(cx: number, cy: number, values: number[]): string {
  const points: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const r = values[i] ?? 0;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

interface PerformerDetail {
  id: number;
  name: string;
  aliases?: string[];
  heroImage?: string | null;
  thumbnail?: string | null;
  description?: string;
  metrics?: {
    releaseCount?: number;
    trendingScore?: number;
    fanScore?: number;
  };
  services?: string[];
  tags?: string[];
  height?: number;
  cup?: string;
  birthdate?: string;
  // 追加項目
  debutYear?: number;
  lastReleaseDate?: string;
  bust?: number;
  waist?: number;
  hip?: number;
}

interface PerformerCompareProps {
  performerIds: string[];
  locale?: string;
  theme?: 'light' | 'dark';
  onPerformerClick?: (performerId: string) => void;
  onRemovePerformer?: (performerId: string) => void;
}

export function PerformerCompare({
  performerIds,
  locale = 'ja',
  theme = 'dark',
  onPerformerClick,
  onRemovePerformer,
}: PerformerCompareProps) {
  const [performers, setPerformers] = useState<PerformerDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedIdsRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  const performersRef = useRef<PerformerDetail[]>([]);

  performersRef.current = performers;

  const isDark = theme === 'dark';

  const idsKey = useMemo(() => [...performerIds].sort().join(','), [performerIds]);

  useEffect(() => {
    if (performerIds.length === 0) {
      setPerformers([]);
      lastFetchedIdsRef.current = '';
      return;
    }

    if (lastFetchedIdsRef.current === idsKey) {
      return;
    }

    const currentPerformers = performersRef.current;
    const currentPerformerIds = new Set(currentPerformers.map(p => String(p.id)));
    const allIdsExist = performerIds.every(id => currentPerformerIds.has(String(id)));

    if (allIdsExist && currentPerformers.length > 0) {
      const filteredPerformers = currentPerformers.filter(p => performerIds.includes(String(p.id)));
      setPerformers(filteredPerformers);
      lastFetchedIdsRef.current = idsKey;
      return;
    }

    const fetchPerformers = async () => {
      if (isInitialLoadRef.current || performersRef.current.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const results = await Promise.all(
          performerIds.map(async (id) => {
            const res = await fetch(`/api/actresses/${id}`);
            if (!res.ok) return null;
            return res.json();
          })
        );
        setPerformers(results.filter((p): p is PerformerDetail => p !== null));
        lastFetchedIdsRef.current = idsKey;
        isInitialLoadRef.current = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading performers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformers();
  }, [idsKey, performerIds]);

  // 統計の最大値を計算
  const getMaxReleaseCount = () => {
    const counts = performers.map(p => p.metrics?.releaseCount || 0);
    return counts.length > 0 ? Math.max(...counts) : 0;
  };

  const getMaxTrendingScore = () => {
    const scores = performers.map(p => p.metrics?.trendingScore || 0);
    return scores.length > 0 ? Math.max(...scores) : 0;
  };

  const getMaxFanScore = () => {
    const scores = performers.map(p => p.metrics?.fanScore || 0);
    return scores.length > 0 ? Math.max(...scores) : 0;
  };

  const maxReleaseCount = getMaxReleaseCount();
  const maxTrendingScore = getMaxTrendingScore();
  const maxFanScore = getMaxFanScore();

  // 共通のタグを見つける
  const commonTags = useMemo(() => {
    if (performers.length < 2) return [];
    const allTags = performers.map(p => new Set(p.tags || []));
    const first = allTags[0];
    return Array.from(first ?? []).filter(tag => allTags.every(set => set.has(tag)));
  }, [performers]);

  // 共通のサービスを見つける
  const commonServices = useMemo(() => {
    if (performers.length < 2) return [];
    const allServices = performers.map(p => new Set(p.services || []));
    const first = allServices[0];
    return Array.from(first ?? []).filter(service => allServices.every(set => set.has(service)));
  }, [performers]);

  // 空の状態
  if (performerIds.length === 0) {
    return (
      <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${
        isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
      }`}>
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isDark ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <svg className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {locale === 'ja' ? '女優を比較しましょう' : 'Compare Performers'}
        </p>
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {locale === 'ja'
            ? '女優を選択すると比較できます'
            : 'Select performers to compare'}
        </p>
      </div>
    );
  }

  // ローディング
  if (isLoading) {
    return (
      <div className={`rounded-2xl border p-8 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative w-12 h-12">
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
              isDark ? 'border-purple-500' : 'border-purple-600'
            }`} />
          </div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
            {locale === 'ja' ? '女優情報を読み込み中...' : 'Loading performers...'}
          </p>
        </div>
      </div>
    );
  }

  // エラー
  if (error) {
    return (
      <div className={`rounded-2xl border p-8 ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isDark ? 'bg-red-800' : 'bg-red-100'
          }`}>
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 女優カード */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${performers.length}, 1fr)` }}>
        {performers.map((performer) => {
          const isMostReleases = (performer.metrics?.releaseCount || 0) === maxReleaseCount && maxReleaseCount > 0;
          const isMostTrending = (performer.metrics?.trendingScore || 0) === maxTrendingScore && maxTrendingScore > 0;
          const isMostPopular = (performer.metrics?.fanScore || 0) === maxFanScore && maxFanScore > 0;

          return (
            <div
              key={performer['id']}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                isDark
                  ? 'bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-600'
                  : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
              }`}
            >
              {/* 削除ボタン */}
              {onRemovePerformer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemovePerformer(String(performer['id']));
                  }}
                  className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDark
                      ? 'bg-gray-900/80 hover:bg-red-600 text-gray-400 hover:text-white'
                      : 'bg-white/90 hover:bg-red-500 text-gray-500 hover:text-white shadow-sm'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* バッジ */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                {isMostReleases && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
                    {locale === 'ja' ? '出演数No.1' : 'Most Releases'}
                  </span>
                )}
                {isMostTrending && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg">
                    {locale === 'ja' ? '注目度No.1' : 'Most Trending'}
                  </span>
                )}
                {isMostPopular && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg">
                    {locale === 'ja' ? '人気No.1' : 'Most Popular'}
                  </span>
                )}
              </div>

              {/* 画像 */}
              <div
                className="cursor-pointer aspect-square relative overflow-hidden"
                onClick={() => onPerformerClick?.(String(performer['id']))}
              >
                {performer['thumbnail'] || performer['heroImage'] ? (
                  <img
                    src={performer['thumbnail'] || performer['heroImage'] || ''}
                    alt={performer['name']}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-20 h-20 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                {/* グラデーションオーバーレイ */}
                <div className={`absolute inset-0 bg-gradient-to-t ${
                  isDark ? 'from-gray-900 via-transparent' : 'from-black/30 via-transparent'
                }`} />
              </div>

              {/* 情報 */}
              <div className="p-4 space-y-4">
                {/* 名前 */}
                <div className="text-center">
                  <h3
                    className={`font-bold text-lg cursor-pointer hover:underline ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                    onClick={() => onPerformerClick?.(String(performer['id']))}
                  >
                    {performer['name']}
                  </h3>
                  {performer.aliases && performer.aliases.length > 0 && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {performer.aliases.slice(0, 2).join(' / ')}
                    </p>
                  )}
                </div>

                {/* メトリクス */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-3 rounded-xl text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '出演数' : 'Releases'}
                    </div>
                    <div className={`text-xl font-bold ${
                      isMostReleases ? 'text-blue-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {performer.metrics?.releaseCount || 0}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '注目度' : 'Trending'}
                    </div>
                    <div className={`text-xl font-bold ${
                      isMostTrending ? 'text-pink-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {performer.metrics?.trendingScore || 0}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '人気度' : 'Fan Score'}
                    </div>
                    <div className={`text-xl font-bold ${
                      isMostPopular ? 'text-yellow-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {performer.metrics?.fanScore || 0}%
                    </div>
                  </div>
                </div>

                {/* プロフィール */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '身長' : 'Height'}
                    </div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {performer['height'] ? `${performer['height']}cm` : '-'}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'カップ' : 'Cup'}
                    </div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {performer['cup'] || '-'}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'デビュー' : 'Debut'}
                    </div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {performer['debutYear'] || '-'}
                    </div>
                  </div>
                </div>

                {/* スリーサイズ */}
                {(performer['bust'] || performer['waist'] || performer['hip']) && (
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'スリーサイズ' : 'Measurements'}
                    </div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      B{performer['bust'] || '-'} W{performer['waist'] || '-'} H{performer['hip'] || '-'}
                    </div>
                  </div>
                )}

                {/* 配信サイト */}
                {performer.services && performer.services.length > 0 && (
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '配信サイト' : 'Services'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {performer.services.slice(0, 4).map((service, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded-full ${
                            commonServices.includes(service)
                              ? isDark
                                ? 'bg-green-900/50 text-green-400 border border-green-700'
                                : 'bg-green-100 text-green-700 border border-green-200'
                              : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {service}
                        </span>
                      ))}
                      {performer.services.length > 4 && (
                        <span className={`px-2 py-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          +{performer.services.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* タグ */}
                {performer.tags && performer.tags.length > 0 && (
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'タグ' : 'Tags'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {performer.tags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded-full ${
                            commonTags.includes(tag)
                              ? isDark
                                ? 'bg-purple-900/50 text-purple-400 border border-purple-700'
                                : 'bg-purple-100 text-purple-700 border border-purple-200'
                              : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {performer.tags.length > 5 && (
                        <span className={`px-2 py-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          +{performer.tags.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 詳細を見るボタン */}
                <button
                  onClick={() => onPerformerClick?.(String(performer['id']))}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {locale === 'ja' ? '詳細を見る' : 'View Details'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 比較グラフセクション */}
      {performers.length >= 2 && (
        <div className={`rounded-2xl p-5 ${
          isDark
            ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700'
            : 'bg-gradient-to-r from-gray-50 to-white border border-gray-200'
        }`}>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {locale === 'ja' ? '比較グラフ' : 'Comparison Chart'}
          </h3>

          {/* レーダーチャート */}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {locale === 'ja' ? 'レーダーチャート' : 'Radar Chart'}
              </p>
              <div className="relative aspect-square max-w-[300px] mx-auto">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {/* 背景グリッド */}
                  {[100, 75, 50, 25].map((r) => (
                    <polygon
                      key={r}
                      points={getRadarPoints(100, 100, r * 0.8, 3)}
                      fill="none"
                      stroke={isDark ? '#374151' : '#e5e7eb'}
                      strokeWidth="1"
                    />
                  ))}
                  {/* 軸線 */}
                  {[0, 1, 2].map((i) => {
                    const angle = (Math.PI * 2 * i) / 3 - Math.PI / 2;
                    const x = 100 + Math.cos(angle) * 80;
                    const y = 100 + Math.sin(angle) * 80;
                    return (
                      <line
                        key={i}
                        x1="100"
                        y1="100"
                        x2={x}
                        y2={y}
                        stroke={isDark ? '#374151' : '#e5e7eb'}
                        strokeWidth="1"
                      />
                    );
                  })}
                  {/* ラベル */}
                  <text x="100" y="12" textAnchor="middle" className={`text-[10px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '出演数' : 'Releases'}
                  </text>
                  <text x="175" y="160" textAnchor="middle" className={`text-[10px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '注目度' : 'Trending'}
                  </text>
                  <text x="25" y="160" textAnchor="middle" className={`text-[10px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '人気度' : 'Fan Score'}
                  </text>
                  {/* 各パフォーマーのデータ */}
                  {performers.map((performer, idx) => {
                    const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];
                    const releaseNorm = maxReleaseCount > 0 ? ((performer.metrics?.releaseCount || 0) / maxReleaseCount) * 80 : 0;
                    const trendNorm = maxTrendingScore > 0 ? ((performer.metrics?.trendingScore || 0) / maxTrendingScore) * 80 : 0;
                    const fanNorm = maxFanScore > 0 ? ((performer.metrics?.fanScore || 0) / maxFanScore) * 80 : 0;
                    const points = getRadarDataPoints(100, 100, [releaseNorm, trendNorm, fanNorm]);
                    return (
                      <g key={performer['id']}>
                        <polygon
                          points={points}
                          fill={colors[idx % colors.length]}
                          fillOpacity="0.2"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="2"
                        />
                        {/* データポイント */}
                        {points.split(' ').map((point, pi) => {
                          const [px, py] = point.split(',').map(Number);
                          return (
                            <circle
                              key={pi}
                              cx={px}
                              cy={py}
                              r="4"
                              fill={colors[idx % colors.length]}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
              {/* 凡例 */}
              <div className="flex justify-center gap-4 mt-3">
                {performers.map((performer, idx) => {
                  const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];
                  return (
                    <div key={performer['id']} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[idx % colors.length] }}
                      />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {performer['name'].slice(0, 6)}{performer['name'].length > 6 ? '…' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* バーチャート */}
            <div className="flex-1">
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {locale === 'ja' ? '棒グラフ比較' : 'Bar Comparison'}
              </p>
              <div className="space-y-4">
                {/* 出演数 */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '出演数' : 'Releases'}
                  </p>
                  <div className="space-y-1.5">
                    {performers.map((performer, idx) => {
                      const colors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-emerald-500'];
                      const percent = maxReleaseCount > 0 ? ((performer.metrics?.releaseCount || 0) / maxReleaseCount) * 100 : 0;
                      return (
                        <div key={performer['id']} className="flex items-center gap-2">
                          <span className={`text-xs w-16 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {performer['name'].slice(0, 6)}
                          </span>
                          <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percent, 5)}%` }}
                            >
                              <span className="text-[10px] text-white font-semibold">
                                {performer.metrics?.releaseCount || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 注目度 */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '注目度' : 'Trending'}
                  </p>
                  <div className="space-y-1.5">
                    {performers.map((performer, idx) => {
                      const colors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-emerald-500'];
                      const percent = maxTrendingScore > 0 ? ((performer.metrics?.trendingScore || 0) / maxTrendingScore) * 100 : 0;
                      return (
                        <div key={performer['id']} className="flex items-center gap-2">
                          <span className={`text-xs w-16 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {performer['name'].slice(0, 6)}
                          </span>
                          <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percent, 5)}%` }}
                            >
                              <span className="text-[10px] text-white font-semibold">
                                {performer.metrics?.trendingScore || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 人気度 */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '人気度' : 'Fan Score'}
                  </p>
                  <div className="space-y-1.5">
                    {performers.map((performer, idx) => {
                      const colors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-emerald-500'];
                      const percent = maxFanScore > 0 ? ((performer.metrics?.fanScore || 0) / maxFanScore) * 100 : 0;
                      return (
                        <div key={performer['id']} className="flex items-center gap-2">
                          <span className={`text-xs w-16 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {performer['name'].slice(0, 6)}
                          </span>
                          <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percent, 5)}%` }}
                            >
                              <span className="text-[10px] text-white font-semibold">
                                {performer.metrics?.fanScore || 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 共通点サマリー */}
      {(commonTags.length > 0 || commonServices.length > 0) && (
        <div className={`rounded-2xl p-5 ${
          isDark
            ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700'
            : 'bg-gradient-to-r from-gray-50 to-white border border-gray-200'
        }`}>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {locale === 'ja' ? '共通点' : 'Common Features'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {commonServices.map((service, i) => (
              <span
                key={`s-${i}`}
                className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {service}
              </span>
            ))}
            {commonTags.map((tag, i) => (
              <span
                key={`t-${i}`}
                className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-purple-900/50 text-purple-400 border border-purple-700'
                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
