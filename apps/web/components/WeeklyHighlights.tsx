'use client';

import { WeeklyHighlightsSection } from '@adult-v/shared/components';

interface WeeklyHighlightsProps {
  locale: string;
}

/**
 * 今週の注目セクション
 * 共有コンポーネントを使用
 */
export default function WeeklyHighlights({ locale }: WeeklyHighlightsProps) {
  return (
    <WeeklyHighlightsSection
      locale={locale}
      theme="dark"
    />
  );
}
