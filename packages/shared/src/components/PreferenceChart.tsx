'use client';

import { useMemo, useCallback, memo } from 'react';

interface PreferenceData {
  label: string;
  value: number; // 0-100
  color?: string;
}

export type PreferenceChartTheme = 'dark' | 'light';

interface PreferenceChartProps {
  data: PreferenceData[];
  size?: number;
  className?: string;
  theme?: PreferenceChartTheme;
}

// Theme configuration
const themeConfig = {
  dark: {
    gridStroke: 'rgba(255, 255, 255, 0.1)',
    axisStroke: 'rgba(255, 255, 255, 0.15)',
    dataFill: 'rgba(244, 63, 94, 0.3)',
    dataStroke: 'rgb(244, 63, 94)',
    pointFill: 'rgb(244, 63, 94)',
    labelClass: 'fill-gray-300',
    valueClass: 'fill-rose-400',
    emptyText: 'text-gray-500',
    barLabelClass: 'text-gray-300',
    barValueClass: 'text-rose-400',
    barBgClass: 'bg-gray-700',
    barFillClass: 'bg-gradient-to-r from-rose-600 to-rose-400',
  },
  light: {
    gridStroke: 'rgba(0, 0, 0, 0.1)',
    axisStroke: 'rgba(0, 0, 0, 0.15)',
    dataFill: 'rgba(236, 72, 153, 0.3)',
    dataStroke: 'rgb(236, 72, 153)',
    pointFill: 'rgb(236, 72, 153)',
    labelClass: 'fill-gray-700',
    valueClass: 'fill-pink-500',
    emptyText: 'text-gray-400',
    barLabelClass: 'text-gray-700',
    barValueClass: 'text-pink-500',
    barBgClass: 'bg-gray-200',
    barFillClass: 'bg-gradient-to-r from-pink-500 to-pink-400',
  },
} as const;

/**
 * SVGベースのレーダーチャート
 * 好みの傾向を視覚化
 */
function PreferenceChartComponent({
  data,
  size = 300,
  className = '',
  theme = 'dark',
}: PreferenceChartProps) {
  const center = size / 2;
  const maxRadius = (size / 2) * 0.8;
  const numPoints = data.length;
  const colors = themeConfig[theme];

  // 角度計算（上から時計回り）
  const getAngle = useCallback((index: number) => {
    return (index * 2 * Math.PI) / numPoints - Math.PI / 2;
  }, [numPoints]);

  // 座標計算
  const getPoint = useCallback((index: number, value: number) => {
    const angle = getAngle(index);
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  }, [getAngle, center, maxRadius]);

  // 背景グリッドの生成
  const gridLevels = useMemo(() => [20, 40, 60, 80, 100], []);
  const gridPaths = useMemo(() => {
    return gridLevels.map((level) => {
      const points = data.map((_, i) => {
        const point = getPoint(i, level);
        return `${point.x},${point.y}`;
      });
      return `M ${points.join(' L ')} Z`;
    });
  }, [data, getPoint, gridLevels]);

  // データポリゴンの生成
  const dataPath = useMemo(() => {
    const points = data.map((item, i) => {
      const point = getPoint(i, item.value);
      return `${point.x},${point.y}`;
    });
    return `M ${points.join(' L ')} Z`;
  }, [data, getPoint]);

  // 軸線の生成
  const axisLines = useMemo(() => {
    return data.map((_, i) => {
      const point = getPoint(i, 100);
      return { x1: center, y1: center, x2: point.x, y2: point.y };
    });
  }, [data, getPoint, center]);

  // ラベル位置の計算
  const labelPositions = useMemo(() => {
    return data.map((item, i) => {
      const angle = getAngle(i);
      const labelRadius = maxRadius + 25;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);

      // テキストアンカーの調整
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (Math.cos(angle) > 0.1) textAnchor = 'start';
      else if (Math.cos(angle) < -0.1) textAnchor = 'end';

      return { x, y, textAnchor, label: item.label, value: item.value };
    });
  }, [data, getAngle, center, maxRadius]);

  if (data.length < 3) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <p className={`${colors.emptyText} text-sm`}>データが不足しています</p>
      </div>
    );
  }

  return (
    <svg width={size} height={size} className={className}>
      {/* 背景グリッド */}
      {gridPaths.map((path, i) => (
        <path
          key={`grid-${i}`}
          d={path}
          fill="none"
          stroke={colors.gridStroke}
          strokeWidth={1}
        />
      ))}

      {/* 軸線 */}
      {axisLines.map((line, i) => (
        <line
          key={`axis-${i}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={colors.axisStroke}
          strokeWidth={1}
        />
      ))}

      {/* データエリア */}
      <path
        d={dataPath}
        fill={colors.dataFill}
        stroke={colors.dataStroke}
        strokeWidth={2}
      />

      {/* データポイント */}
      {data.map((item, i) => {
        const point = getPoint(i, item.value);
        return (
          <circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={colors.pointFill}
          />
        );
      })}

      {/* ラベル */}
      {labelPositions.map((pos, i) => (
        <g key={`label-${i}`}>
          <text
            x={pos.x}
            y={pos.y - 4}
            textAnchor={pos.textAnchor}
            className={`${colors.labelClass} text-xs font-medium`}
          >
            {pos.label}
          </text>
          <text
            x={pos.x}
            y={pos.y + 10}
            textAnchor={pos.textAnchor}
            className={`${colors.valueClass} text-xs font-bold`}
          >
            {pos.value}%
          </text>
        </g>
      ))}
    </svg>
  );
}

// Memoize to prevent re-renders when parent updates but data unchanged
const PreferenceChart = memo(PreferenceChartComponent);
export default PreferenceChart;

interface PreferenceBarChartProps {
  data: PreferenceData[];
  className?: string;
  theme?: PreferenceChartTheme;
}

/**
 * 棒グラフスタイルの好み表示
 */
function PreferenceBarChartComponent({
  data,
  className = '',
  theme = 'dark',
}: PreferenceBarChartProps) {
  const colors = themeConfig[theme];

  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className={colors.barLabelClass}>{item.label}</span>
            <span className={`${colors.barValueClass} font-medium`}>{item.value}%</span>
          </div>
          <div className={`h-2 ${colors.barBgClass} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${colors.barFillClass} rounded-full transition-all duration-500`}
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Memoize to prevent re-renders when parent updates but data unchanged
export const PreferenceBarChart = memo(PreferenceBarChartComponent);
