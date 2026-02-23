'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MakerStats {
  makerId: number;
  makerName: string;
  productCount: number;
  sharePercent: number;
}

interface Props {
  data: MakerStats[];
}

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
];

export default function MakerShareChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg">メーカーデータがありません</p>
          <p className="mt-1 text-sm">データが登録されると表示されます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => value.toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="makerName"
            tick={{ fontSize: 11 }}
            className="text-gray-600 dark:text-gray-400"
            width={95}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              border: '1px solid var(--tooltip-border, #e5e7eb)',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value.toLocaleString()}作品 (${props.payload.sharePercent}%)`,
              'シェア',
            ]}
          />
          <Bar dataKey="productCount" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
