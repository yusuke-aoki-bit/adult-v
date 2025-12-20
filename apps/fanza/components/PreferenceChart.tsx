'use client';

import { PreferenceChart as BasePreferenceChart, PreferenceBarChart as BasePreferenceBarChart } from '@adult-v/shared/components';

interface PreferenceData {
  label: string;
  value: number;
  color?: string;
}

interface PreferenceChartProps {
  data: PreferenceData[];
  size?: number;
  className?: string;
}

/**
 * PreferenceChart wrapper for apps/fanza (light theme)
 */
export default function PreferenceChart(props: PreferenceChartProps) {
  return <BasePreferenceChart {...props} theme="light" />;
}

/**
 * PreferenceBarChart wrapper for apps/fanza (light theme)
 */
export function PreferenceBarChart(props: { data: PreferenceData[]; className?: string }) {
  return <BasePreferenceBarChart {...props} theme="light" />;
}
