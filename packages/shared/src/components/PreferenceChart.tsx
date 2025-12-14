'use client';

import { useMemo } from 'react';

interface PreferenceData {
  label: string;
  value: number; // 0-100
  color?: string;
}

interface PreferenceChartProps {
  data: PreferenceData[];
  size?: number;
  className?: string;
}

/**
 * SVGベースのレーダーチャート
 * 好みの傾向を視覚化
 */
export default function PreferenceChart({
  data,
  size = 300,
  className = '',
}: PreferenceChartProps) {
  const center = size / 2;
  const maxRadius = (size / 2) * 0.8;
  const numPoints = data.length;

  // 角度計算（上から時計回り）
  const getAngle = (index: number) => {
    return (index * 2 * Math.PI) / numPoints - Math.PI / 2;
  };

  // 座標計算
  const getPoint = (index: number, value: number) => {
    const angle = getAngle(index);
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // 背景グリッドの生成
  const gridLevels = [20, 40, 60, 80, 100];
  const gridPaths = useMemo(() => {
    return gridLevels.map((level) => {
      const points = data.map((_, i) => {
        const point = getPoint(i, level);
        return `${point.x},${point.y}`;
      });
      return `M ${points.join(' L ')} Z`;
    });
  }, [data, center, maxRadius]);

  // データポリゴンの生成
  const dataPath = useMemo(() => {
    const points = data.map((item, i) => {
      const point = getPoint(i, item.value);
      return `${point.x},${point.y}`;
    });
    return `M ${points.join(' L ')} Z`;
  }, [data, center, maxRadius]);

  // 軸線の生成
  const axisLines = useMemo(() => {
    return data.map((_, i) => {
      const point = getPoint(i, 100);
      return { x1: center, y1: center, x2: point.x, y2: point.y };
    });
  }, [data, center, maxRadius]);

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
  }, [data, center, maxRadius]);

  if (data.length < 3) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <p className="text-gray-500 text-sm">データが不足しています</p>
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
          stroke="rgba(255, 255, 255, 0.1)"
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
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={1}
        />
      ))}

      {/* データエリア */}
      <path
        d={dataPath}
        fill="rgba(244, 63, 94, 0.3)"
        stroke="rgb(244, 63, 94)"
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
            fill="rgb(244, 63, 94)"
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
            className="fill-gray-300 text-xs font-medium"
          >
            {pos.label}
          </text>
          <text
            x={pos.x}
            y={pos.y + 10}
            textAnchor={pos.textAnchor}
            className="fill-rose-400 text-xs font-bold"
          >
            {pos.value}%
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * 棒グラフスタイルの好み表示
 */
export function PreferenceBarChart({
  data,
  className = '',
}: {
  data: PreferenceData[];
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item, index) => (
        <div key={index}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">{item.label}</span>
            <span className="text-rose-400 font-medium">{item.value}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500"
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
