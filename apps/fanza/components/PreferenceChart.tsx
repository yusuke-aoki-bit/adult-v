'use client';

import { memo } from 'react';
import { PreferenceChart as BasePreferenceChart, PreferenceBarChart as BasePreferenceBarChart } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

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
 * PreferenceChart wrapper - テーマはSiteContextから自動取得
 */
const PreferenceChart = memo(function PreferenceChart(props: PreferenceChartProps) {
  const theme = useSiteTheme();
  return <BasePreferenceChart {...props} theme={theme} />;
});

export default PreferenceChart;

/**
 * PreferenceBarChart wrapper - テーマはSiteContextから自動取得
 */
export const PreferenceBarChart = memo(function PreferenceBarChart(props: { data: PreferenceData[]; className?: string }) {
  const theme = useSiteTheme();
  return <BasePreferenceBarChart {...props} theme={theme} />;
});
