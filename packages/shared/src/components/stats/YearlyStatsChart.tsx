'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface YearlyStats {
  year: number;
  totalProducts: number;
  totalPerformers: number;
}

interface Props {
  data: YearlyStats[];
}

export default function YearlyStatsChart({ data }: Props) {
  // 古い順にソート
  const sortedData = [...data].sort((a, b) => a.year - b.year);

  return (
    <div className="w-full h-[300px] md:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={sortedData}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorPerformers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              border: '1px solid var(--tooltip-border, #e5e7eb)',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === 'totalProducts' ? '作品数' : '出演女優数',
            ]}
            labelFormatter={(label) => `${label}年`}
          />
          <Legend
            formatter={(value) => (value === 'totalProducts' ? '作品数' : '出演女優数')}
          />
          <Area
            type="monotone"
            dataKey="totalProducts"
            stroke="#6366f1"
            fillOpacity={1}
            fill="url(#colorProducts)"
          />
          <Area
            type="monotone"
            dataKey="totalPerformers"
            stroke="#ec4899"
            fillOpacity={1}
            fill="url(#colorPerformers)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
