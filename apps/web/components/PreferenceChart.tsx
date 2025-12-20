'use client';

import { PreferenceChart as BasePreferenceChart, PreferenceBarChart as BasePreferenceBarChart } from '@adult-v/shared/components';
import type { PreferenceChartTheme } from '@adult-v/shared/components';

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
 * PreferenceChart wrapper for apps/web (dark theme)
 */
export default function PreferenceChart(props: PreferenceChartProps) {
  return <BasePreferenceChart {...props} theme="dark" />;
}

/**
 * PreferenceBarChart wrapper for apps/web (dark theme)
 */
export function PreferenceBarChart(props: { data: PreferenceData[]; className?: string }) {
  return <BasePreferenceBarChart {...props} theme="dark" />;
}
