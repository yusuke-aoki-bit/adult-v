'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DebutStats {
  year: number;
  debutCount: number;
}

interface Props {
  data: DebutStats[];
}

const COLORS = [
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#94a3b8',
  '#6366f1',
  '#8b5cf6',
];

export default function DebutTrendChart({ data }: Props) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} className="text-gray-600 dark:text-gray-400" />
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
            formatter={(value: number) => [`${value.toLocaleString()}名`, 'デビュー数']}
            labelFormatter={(label) => `${label}年`}
          />
          <Bar dataKey="debutCount" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.year === currentYear ? '#8b5cf6' : entry.year === currentYear - 1 ? '#6366f1' : '#94a3b8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
