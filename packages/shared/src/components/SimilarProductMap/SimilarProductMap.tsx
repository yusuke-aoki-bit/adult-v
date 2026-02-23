'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, similarProductMapTranslations } from '../../lib/translations';

type ViewMode = 'list' | 'network';

interface SimilarProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  thumbnailUrl: string | null;
  similarityScore: number;
  similarityReasons: string[];
  performerScore: number;
  makerScore: number;
  genreScore: number;
  hop: number;
}

interface NetworkEdge {
  source: number;
  target: number;
  weight: number;
}

interface ProductSimilarityData {
  success: boolean;
  product: {
    id: number;
    title: string;
    normalizedProductId: string | null;
    thumbnailUrl: string | null;
  };
  similar: SimilarProduct[];
  edges: NetworkEdge[];
  stats: {
    totalSimilarCount: number;
    avgSimilarityScore: number;
  };
}

interface SimilarProductMapProps {
  productId: number;
  locale: string;
  theme?: 'light' | 'dark';
  onProductClick?: (productId: number) => void;
}

// ホップごとの色設定
const HOP_COLORS = {
  1: { fill: '#EC4899', stroke: '#F472B6', light: { fill: '#DB2777', stroke: '#EC4899' } }, // pink (出演者)
  2: { fill: '#8B5CF6', stroke: '#A78BFA', light: { fill: '#7C3AED', stroke: '#8B5CF6' } }, // violet (ジャンル)
};

export function SimilarProductMap({ productId, locale, theme: themeProp, onProductClick }: SimilarProductMapProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const mt = getTranslation(similarProductMapTranslations, locale);
  const [data, setData] = useState<ProductSimilarityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('network');

  useEffect(() => {
    const fetchSimilar = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/products/${productId}/similar?limit=12`);
        if (!response.ok) {
          throw new Error('Failed to fetch similar products');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [productId]);

  // 2ホップネットワーク用のノード位置計算
  const { networkNodes, nodePositions } = useMemo(() => {
    if (!data) return { networkNodes: [], nodePositions: new Map<number, { x: number; y: number }>() };

    const centerX = 250;
    const centerY = 250;
    const positions = new Map<number, { x: number; y: number }>();

    // 中心ノード
    positions.set(data.product['id'], { x: centerX, y: centerY });

    // ホップごとにグループ化
    const hop1 = data.similar.filter((r) => r.hop === 1);
    const hop2 = data.similar.filter((r) => r.hop === 2);

    // 1ホップ目：中心から近い円
    const radius1 = 100;
    hop1.forEach((sim, index) => {
      const angle = (2 * Math.PI * index) / Math.max(hop1.length, 1) - Math.PI / 2;
      positions.set(sim.id, {
        x: centerX + radius1 * Math.cos(angle),
        y: centerY + radius1 * Math.sin(angle),
      });
    });

    // 2ホップ目：外側の円
    const radius2 = 180;
    hop2.forEach((sim, index) => {
      const angle = (2 * Math.PI * index) / Math.max(hop2.length, 1) - Math.PI / 2 + Math.PI / Math.max(hop2.length, 1);
      positions.set(sim.id, {
        x: centerX + radius2 * Math.cos(angle),
        y: centerY + radius2 * Math.sin(angle),
      });
    });

    const nodes = data.similar.map((sim) => ({
      ...sim,
      x: positions.get(sim.id)?.x || 0,
      y: positions.get(sim.id)?.y || 0,
    }));

    return { networkNodes: nodes, nodePositions: positions };
  }, [data]);

  const isDark = theme === 'dark';

  // ホップごとの色を取得
  const getHopColor = (hop: number) => {
    const colors = HOP_COLORS[hop as keyof typeof HOP_COLORS] || HOP_COLORS[1];
    return isDark ? { fill: colors.fill, stroke: colors.stroke } : colors.light;
  };

  // 類似度に基づく色を取得
  const getScoreColor = (score: number) => {
    const percent = Math.round(score * 100);
    if (percent >= 70) return { bg: '#16A34A', text: 'white' };
    if (percent >= 50) return { bg: '#EAB308', text: 'white' };
    return { bg: '#F97316', text: 'white' };
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-6 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-center gap-2">
          <svg
            className={`h-5 w-5 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{mt.analyzing}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.similar.length === 0) {
    return null;
  }

  return (
    <div className={`overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'border border-gray-200 bg-white'}`}>
      {/* ヘッダー */}
      <div className={`border-b p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{mt.networkTitle}</h3>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{mt.networkSubtitle}</p>
          </div>
          {/* 表示切り替えボタン */}
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-2 transition-colors ${
                viewMode === 'list'
                  ? isDark
                    ? 'bg-sky-600 text-white'
                    : 'bg-rose-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={mt.listView}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`rounded p-2 transition-colors ${
                viewMode === 'network'
                  ? isDark
                    ? 'bg-sky-600 text-white'
                    : 'bg-rose-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={mt.networkView}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <circle cx="4" cy="8" r="2" strokeWidth={2} />
                <circle cx="20" cy="8" r="2" strokeWidth={2} />
                <circle cx="4" cy="16" r="2" strokeWidth={2} />
                <circle cx="20" cy="16" r="2" strokeWidth={2} />
                <path
                  strokeLinecap="round"
                  strokeWidth={2}
                  d="M9 10.5L5.5 8.5M15 10.5L18.5 8.5M9 13.5L5.5 15.5M15 13.5L18.5 15.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      {viewMode === 'network' &&
        (() => {
          const hop1Data = data.similar.filter((s) => s.hop === 1);
          const isMakerBased = hop1Data.length > 0 && (hop1Data[0]?.makerScore ?? 0) > 0;
          return (
            <div className={`flex gap-4 px-4 py-2 text-xs ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getHopColor(1).fill }} />
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {isMakerBased ? mt.sameMaker : mt.samePerformer}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getHopColor(2).fill }} />
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{mt.similarGenre}</span>
              </div>
            </div>
          );
        })()}

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className="p-4">
          {[1, 2].map((hop) => {
            const hopSimilar = data.similar.filter((s) => s.hop === hop);
            if (hopSimilar.length === 0) return null;
            const isMakerBased = hop === 1 && (hopSimilar[0]?.makerScore ?? 0) > 0;
            return (
              <div key={hop} className="mb-4 last:mb-0">
                <h4
                  className={`mb-2 flex items-center gap-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getHopColor(hop).fill }} />
                  {hop === 1
                    ? isMakerBased
                      ? mt.sameMakerProducts
                      : mt.samePerformerProducts
                    : mt.similarGenreProducts}
                </h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {hopSimilar.map((sim) => {
                    const scorePercent = Math.round(sim.similarityScore * 100);
                    return (
                      <div
                        key={sim.id}
                        className={`group cursor-pointer overflow-hidden rounded-lg transition-transform hover:scale-105 ${
                          isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => onProductClick?.(sim.id)}
                      >
                        <div className="relative aspect-2/3 overflow-hidden">
                          {sim.thumbnailUrl ? (
                            <img src={sim.thumbnailUrl} alt={sim.title} className="h-full w-full object-cover" />
                          ) : (
                            <div
                              className={`flex h-full w-full items-center justify-center ${
                                isDark ? 'bg-gray-600' : 'bg-gray-200'
                              }`}
                            >
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>NO IMAGE</span>
                            </div>
                          )}
                          <div
                            className="absolute top-2 right-2 rounded px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: getScoreColor(sim.similarityScore).bg }}
                          >
                            {scorePercent}%
                          </div>
                        </div>
                        <div className="p-2">
                          <p className={`truncate text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {sim.normalizedProductId || sim.title.slice(0, 10)}
                          </p>
                          {sim.similarityReasons.length > 0 && (
                            <p className={`mt-0.5 truncate text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {sim.similarityReasons[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ネットワーク図表示 */}
      {viewMode === 'network' && (
        <div className="p-4">
          <div className="flex justify-center">
            <svg width="500" height="500" viewBox="0 0 500 500" className="max-w-full">
              {/* エッジ（関係線）を描画 */}
              {data.edges.map((edge, idx) => {
                const sourcePos = nodePositions.get(edge.source);
                const targetPos = nodePositions.get(edge.target);
                if (!sourcePos || !targetPos) return null;

                const targetNode = data.similar.find((s) => s.id === edge.target);
                const hopColor = targetNode ? getHopColor(targetNode.hop) : getHopColor(1);
                const strokeWidth = Math.max(1, edge.weight / 30);

                return (
                  <line
                    key={`edge-${idx}`}
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={hopColor.fill}
                    strokeWidth={strokeWidth}
                    opacity={0.4}
                  />
                );
              })}

              {/* 中心ノード（対象の作品） */}
              <g className="group/center cursor-pointer">
                <title>{`${data.product.normalizedProductId || ''} ${data.product['title']}`.trim()}</title>
                <circle
                  cx="250"
                  cy="250"
                  r="35"
                  fill={isDark ? '#0EA5E9' : '#E11D48'}
                  stroke={isDark ? '#38BDF8' : '#FB7185'}
                  strokeWidth="3"
                  className="transition-all group-hover/center:stroke-5"
                />
                <defs>
                  <clipPath id="product-center-clip">
                    <circle cx="250" cy="250" r="32" />
                  </clipPath>
                </defs>
                {data.product['thumbnailUrl'] && (
                  <image
                    href={data.product['thumbnailUrl']}
                    x="218"
                    y="218"
                    width="64"
                    height="64"
                    clipPath="url(#product-center-clip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                )}
                {!data.product['thumbnailUrl'] && (
                  <text x="250" y="255" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                    {(data.product.normalizedProductId || data.product['title']).slice(0, 6)}
                  </text>
                )}
              </g>

              {/* 類似作品ノード */}
              {networkNodes.map((node) => {
                const scorePercent = Math.round(node.similarityScore * 100);
                const hopColor = getHopColor(node.hop);
                const baseRadius = node.hop === 1 ? 25 : 20;
                const nodeRadius = baseRadius;
                const tooltipText = `${node.normalizedProductId || ''} ${node.title}`.trim();

                return (
                  <g key={node.id} className="group/node cursor-pointer" onClick={() => onProductClick?.(node.id)}>
                    <title>{tooltipText}</title>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius}
                      fill={isDark ? '#374151' : '#F3F4F6'}
                      stroke={hopColor.fill}
                      strokeWidth="3"
                      className="transition-all group-hover/node:stroke-5"
                    />
                    <defs>
                      <clipPath id={`product-clip-${node.id}`}>
                        <circle cx={node.x} cy={node.y} r={nodeRadius - 2} />
                      </clipPath>
                    </defs>
                    {node.thumbnailUrl && (
                      <image
                        href={node.thumbnailUrl}
                        x={node.x - nodeRadius + 2}
                        y={node.y - nodeRadius + 2}
                        width={(nodeRadius - 2) * 2}
                        height={(nodeRadius - 2) * 2}
                        clipPath={`url(#product-clip-${node.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                    {!node.thumbnailUrl && (
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fill={isDark ? '#9CA3AF' : '#6B7280'}
                        fontSize={node.hop === 1 ? 8 : 7}
                        fontWeight="bold"
                      >
                        {(node.normalizedProductId || 'N/A').slice(0, 4)}
                      </text>
                    )}
                    {/* 類似度バッジ */}
                    <circle
                      cx={node.x + nodeRadius - 4}
                      cy={node.y - nodeRadius + 4}
                      r={node.hop === 1 ? 12 : 10}
                      fill={getScoreColor(node.similarityScore).bg}
                    />
                    <text
                      x={node.x + nodeRadius - 4}
                      y={node.y - nodeRadius + (node.hop === 1 ? 8 : 7)}
                      textAnchor="middle"
                      fill="white"
                      fontSize={node.hop === 1 ? 9 : 8}
                      fontWeight="bold"
                    >
                      {scorePercent}%
                    </text>
                    {/* 品番ラベル（1ホップ目のみ） */}
                    {node.hop === 1 && (
                      <text
                        x={node.x}
                        y={node.y + nodeRadius + 12}
                        textAnchor="middle"
                        fill={isDark ? '#D1D5DB' : '#374151'}
                        fontSize="8"
                        className="pointer-events-none"
                      >
                        {(node.normalizedProductId || node.title).slice(0, 8)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimilarProductMap;
