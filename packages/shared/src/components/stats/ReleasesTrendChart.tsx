'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyReleaseStats {
  month: string;
  releaseCount: number;
}

interface Props {
  data: MonthlyReleaseStats[];
}

export default function ReleasesTrendChart({ data }: Props) {
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      // YYYY-MM を MM月 形式に変換
      displayMonth: item.month.slice(5) + '月',
    }));
  }, [data]);

  return (
    <div className="h-[300px] w-full md:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => value.slice(5)}
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
            formatter={(value: number) => [value.toLocaleString() + '作品', 'リリース数']}
            labelFormatter={(label) => label + '月'}
          />
          <Line
            type="monotone"
            dataKey="releaseCount"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
