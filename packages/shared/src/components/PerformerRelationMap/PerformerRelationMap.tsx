'use client';

import { useState, useEffect, useMemo } from 'react';

type ViewMode = 'list' | 'network';

interface RelatedPerformer {
  id: number;
  name: string;
  nameEn: string | null;
  profileImageUrl: string | null;
  thumbnailUrl: string | null;
  costarCount: number;
  hop: number;
}

interface NetworkEdge {
  source: number;
  target: number;
  weight: number;
}

interface PerformerRelationsData {
  success: boolean;
  performer: {
    id: number;
    name: string;
    nameEn: string | null;
    profileImageUrl: string | null;
    thumbnailUrl: string | null;
  };
  relations: RelatedPerformer[];
  edges: NetworkEdge[];
  stats: {
    totalCostarCount: number;
    mostFrequentCostar: string | null;
  };
}

interface PerformerRelationMapProps {
  performerId: number;
  locale: string;
  theme?: 'light' | 'dark';
  onPerformerClick?: (performerId: number) => void;
}

// ホップごとの色設定
const HOP_COLORS = {
  1: { fill: '#0EA5E9', stroke: '#38BDF8', light: { fill: '#E11D48', stroke: '#FB7185' } }, // sky/rose
  2: { fill: '#8B5CF6', stroke: '#A78BFA', light: { fill: '#7C3AED', stroke: '#8B5CF6' } }, // violet
  3: { fill: '#10B981', stroke: '#34D399', light: { fill: '#059669', stroke: '#10B981' } }, // emerald
};

const mapTexts = {
  ja: {
    loading: '読み込み中...',
    costarNetwork: '共演者ネットワーク',
    upToHops: '2ホップまでの関係',
    listView: 'リスト表示',
    networkView: 'ネットワーク図',
    firstHop: '直接共演',
    secondHop: '2ホップ',
    directCostars: '直接共演者',
    secondHopLabel: '2ホップ目',
    works: '作品',
    costars: '作品共演',
  },
  en: {
    loading: 'Loading...',
    costarNetwork: 'Costar Network',
    upToHops: 'Up to 2 hops',
    listView: 'List view',
    networkView: 'Network view',
    firstHop: '1st hop',
    secondHop: '2nd hop',
    directCostars: 'Direct Costars',
    secondHopLabel: '2nd Hop',
    works: ' works',
    costars: ' costars',
  },
} as const;

function getMapText(locale: string) {
  return mapTexts[locale as keyof typeof mapTexts] || mapTexts.ja;
}

export function PerformerRelationMap({
  performerId,
  locale,
  theme = 'dark',
  onPerformerClick,
}: PerformerRelationMapProps) {
  const mt = getMapText(locale);
  const [data, setData] = useState<PerformerRelationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('network');
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  useEffect(() => {
    const fetchRelations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/performers/${performerId}/relations?hops=2&limit=8`);
        if (!response.ok) {
          throw new Error('Failed to fetch relations');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRelations();
  }, [performerId]);

  // 3ホップネットワーク用のノード位置計算
  const { networkNodes, nodePositions } = useMemo(() => {
    if (!data) return { networkNodes: [], nodePositions: new Map<number, { x: number; y: number }>() };

    const centerX = 250;
    const centerY = 250;
    const positions = new Map<number, { x: number; y: number }>();

    // 中心ノード
    positions.set(data.performer['id'], { x: centerX, y: centerY });

    // ホップごとにグループ化
    const hop1 = data.relations.filter(r => r.hop === 1);
    const hop2 = data.relations.filter(r => r.hop === 2);
    const hop3 = data.relations.filter(r => r.hop === 3);

    // 1ホップ目：中心から近い円
    const radius1 = 100;
    hop1.forEach((rel, index) => {
      const angle = (2 * Math.PI * index) / hop1.length - Math.PI / 2;
      positions.set(rel.id, {
        x: centerX + radius1 * Math.cos(angle),
        y: centerY + radius1 * Math.sin(angle),
      });
    });

    // 2ホップ目：中間の円
    const radius2 = 170;
    hop2.forEach((rel, index) => {
      const angle = (2 * Math.PI * index) / hop2.length - Math.PI / 2 + Math.PI / hop2.length;
      positions.set(rel.id, {
        x: centerX + radius2 * Math.cos(angle),
        y: centerY + radius2 * Math.sin(angle),
      });
    });

    // 3ホップ目：外側の円
    const radius3 = 220;
    hop3.forEach((rel, index) => {
      const angle = (2 * Math.PI * index) / hop3.length - Math.PI / 2;
      positions.set(rel.id, {
        x: centerX + radius3 * Math.cos(angle),
        y: centerY + radius3 * Math.sin(angle),
      });
    });

    const nodes = data.relations.map(rel => ({
      ...rel,
      x: positions.get(rel.id)?.x || 0,
      y: positions.get(rel.id)?.y || 0,
    }));

    return { networkNodes: nodes, nodePositions: positions };
  }, [data]);

  const isDark = theme === 'dark';

  // ホップごとの色を取得
  const getHopColor = (hop: number) => {
    const colors = HOP_COLORS[hop as keyof typeof HOP_COLORS] || HOP_COLORS[1];
    return isDark ? { fill: colors.fill, stroke: colors.stroke } : colors.light;
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-center gap-2">
          <svg className={`animate-spin w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {mt.loading}
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    console.warn('[PerformerRelationMap] Error or no data:', error);
    return null;
  }

  if (data.relations.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} overflow-hidden`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {mt.costarNetwork}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {mt.upToHops}
            </p>
          </div>
          {/* 表示切り替えボタン */}
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? isDark ? 'bg-sky-600 text-white' : 'bg-rose-600 text-white'
                  : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={mt.listView}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'network'
                  ? isDark ? 'bg-sky-600 text-white' : 'bg-rose-600 text-white'
                  : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={mt.networkView}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <circle cx="4" cy="8" r="2" strokeWidth={2} />
                <circle cx="20" cy="8" r="2" strokeWidth={2} />
                <circle cx="4" cy="16" r="2" strokeWidth={2} />
                <circle cx="20" cy="16" r="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M9 10.5L5.5 8.5M15 10.5L18.5 8.5M9 13.5L5.5 15.5M15 13.5L18.5 15.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      {viewMode === 'network' && (
        <div className={`px-4 py-2 flex gap-4 text-xs ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHopColor(1).fill }} />
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              {mt.firstHop}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHopColor(2).fill }} />
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              {mt.secondHop}
            </span>
          </div>
        </div>
      )}

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className="p-4">
          {[1, 2].map(hop => {
            const hopRelations = data.relations.filter(r => r.hop === hop);
            if (hopRelations.length === 0) return null;
            return (
              <div key={hop} className="mb-4 last:mb-0">
                <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getHopColor(hop).fill }} />
                  {hop === 1 ? mt.directCostars : mt.secondHopLabel}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {hopRelations.map((rel) => {
                    const imageUrl = rel.thumbnailUrl || rel.profileImageUrl;
                    return (
                      <div
                        key={rel.id}
                        className={`group cursor-pointer rounded-lg overflow-hidden transition-transform hover:scale-105 ${
                          isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => onPerformerClick?.(rel.id)}
                      >
                        <div className="aspect-3/4 relative overflow-hidden">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={rel.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${
                              isDark ? 'bg-gray-600' : 'bg-gray-200'
                            }`}>
                              <span className={`text-2xl font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {rel.name[0]}
                              </span>
                            </div>
                          )}
                          <div
                            className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getHopColor(hop).fill }}
                          >
                            {rel.costarCount}{mt.works}
                          </div>
                        </div>
                        <div className="p-2">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {rel.name}
                          </p>
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

                // 中心からのエッジか、ノード間のエッジかで太さを変える
                const isCenterEdge = edge.source === performerId || edge.target === performerId;
                const strokeWidth = isCenterEdge ? Math.min(4, 1 + edge.weight * 0.5) : Math.min(2, 0.5 + edge.weight * 0.3);

                return (
                  <line
                    key={`edge-${idx}`}
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isDark ? '#4B5563' : '#D1D5DB'}
                    strokeWidth={strokeWidth}
                    opacity={isCenterEdge ? 0.7 : 0.3}
                  />
                );
              })}

              {/* 中心ノード（対象の女優） */}
              <g className="cursor-pointer">
                <circle
                  cx="250"
                  cy="250"
                  r="35"
                  fill={isDark ? '#0EA5E9' : '#E11D48'}
                  stroke={isDark ? '#38BDF8' : '#FB7185'}
                  strokeWidth="3"
                />
                <defs>
                  <clipPath id="center-clip-3hop">
                    <circle cx="250" cy="250" r="32" />
                  </clipPath>
                </defs>
                {(data.performer['thumbnailUrl'] || data.performer['profileImageUrl']) && (
                  <image
                    href={data.performer['thumbnailUrl'] || data.performer['profileImageUrl'] || ''}
                    x="218"
                    y="218"
                    width="64"
                    height="64"
                    clipPath="url(#center-clip-3hop)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                )}
                {!data.performer['thumbnailUrl'] && !data.performer['profileImageUrl'] && (
                  <text
                    x="250"
                    y="255"
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {data.performer['name'].slice(0, 2)}
                  </text>
                )}
              </g>

              {/* 共演者ノード */}
              {networkNodes.map((node) => {
                const imageUrl = node.thumbnailUrl || node.profileImageUrl;
                const hopColor = getHopColor(node.hop);
                // ホップ数によってノードサイズを変える（1ホップが大きい）
                const baseRadius = node.hop === 1 ? 25 : node.hop === 2 ? 20 : 16;
                const nodeRadius = Math.min(baseRadius + 3, baseRadius + node.costarCount);
                const isHovered = hoveredNodeId === node.id;
                const tooltipText = `${node.name}${node.nameEn ? ` (${node.nameEn})` : ''} - ${node.costarCount}${mt.costars}`;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => onPerformerClick?.(node.id)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{ filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' : 'none' }}
                  >
                    <title>{tooltipText}</title>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isHovered ? nodeRadius + 3 : nodeRadius}
                      fill={isDark ? '#374151' : '#F3F4F6'}
                      stroke={hopColor.fill}
                      strokeWidth={isHovered ? 4 : 2}
                      style={{ transition: 'all 0.2s ease' }}
                    />
                    <defs>
                      <clipPath id={`clip-3hop-${node.id}`}>
                        <circle cx={node.x} cy={node.y} r={nodeRadius - 2} />
                      </clipPath>
                    </defs>
                    {imageUrl && (
                      <image
                        href={imageUrl}
                        x={node.x - nodeRadius + 2}
                        y={node.y - nodeRadius + 2}
                        width={(nodeRadius - 2) * 2}
                        height={(nodeRadius - 2) * 2}
                        clipPath={`url(#clip-3hop-${node.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                    {!imageUrl && (
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fill={isDark ? '#9CA3AF' : '#6B7280'}
                        fontSize={node.hop === 1 ? 12 : 10}
                        fontWeight="bold"
                      >
                        {node.name[0]}
                      </text>
                    )}
                    {/* 共演数バッジ */}
                    <circle
                      cx={node.x + nodeRadius - 4}
                      cy={node.y - nodeRadius + 4}
                      r={node.hop === 1 ? 10 : 8}
                      fill={hopColor.fill}
                    />
                    <text
                      x={node.x + nodeRadius - 4}
                      y={node.y - nodeRadius + (node.hop === 1 ? 8 : 7)}
                      textAnchor="middle"
                      fill="white"
                      fontSize={node.hop === 1 ? 10 : 8}
                      fontWeight="bold"
                    >
                      {node.costarCount}
                    </text>
                    {/* 名前ラベル（1ホップ目 or ホバー時） */}
                    {(node.hop === 1 || isHovered) && (
                      <text
                        x={node.x}
                        y={node.y + nodeRadius + 12}
                        textAnchor="middle"
                        fill={isDark ? '#D1D5DB' : '#374151'}
                        fontSize={isHovered ? 11 : 9}
                        fontWeight={isHovered ? 'bold' : 'normal'}
                        className="pointer-events-none"
                      >
                        {node.name.length > 6 ? node.name.slice(0, 6) + '...' : node.name}
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

export default PerformerRelationMap;
