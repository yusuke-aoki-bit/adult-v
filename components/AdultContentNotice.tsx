'use client';

import { useParams } from 'next/navigation';

const translations = {
  ja: '※このページは成人向けコンテンツを含みます',
  en: '※This page contains adult content',
  zh: '※此页面包含成人内容',
  ko: '※이 페이지는 성인 콘텐츠를 포함합니다',
} as const;

export default function AdultContentNotice() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const message = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className="bg-amber-900/20 border-b border-amber-700 relative z-40">
      <div className="container mx-auto px-4 py-2">
        <p className="text-amber-200 text-xs sm:text-sm text-center font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
