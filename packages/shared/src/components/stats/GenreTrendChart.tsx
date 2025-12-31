'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface GenreTrend {
  genreId: number;
  genreName: string;
  months: { month: string; count: number }[];
}

interface Props {
  data: GenreTrend[];
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#22c55e',
];

export default function GenreTrendChart({ data }: Props) {
  // 月のリストを取得（全ジャンルで共通のX軸）
  const allMonths = new Set<string>();
  data.forEach(genre => {
    genre.months.forEach(m => allMonths.add(m.month));
  });
  const sortedMonths = Array.from(allMonths).sort();

  // データを変換: 各月に対して全ジャンルのカウントを持つオブジェクト
  const chartData = sortedMonths.map(month => {
    const point: Record<string, string | number> = { month };
    data.forEach(genre => {
      const monthData = genre.months.find(m => m.month === month);
      point[genre.genreName] = monthData?.count || 0;
    });
    return point;
  });

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => value.substring(5)} // YYYY-MM -> MM
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
            formatter={(value: number) => [value.toLocaleString() + '作品', '']}
            labelFormatter={(label) => `${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
          />
          {data.map((genre, index) => (
            <Line
              key={genre.genreId}
              type="monotone"
              dataKey={genre.genreName}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
