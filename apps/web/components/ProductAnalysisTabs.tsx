'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { CostPerformanceCard } from '@adult-v/shared/components';
import UserContributionsWrapper from '@/components/UserContributionsWrapper';

const SceneTimeline = dynamic(() => import('@/components/SceneTimeline'), {
  loading: () => <div className="theme-content h-32 animate-pulse rounded-lg" />,
});
const EnhancedAiReview = dynamic(() => import('@/components/EnhancedAiReview'), {
  loading: () => <div className="theme-content h-48 animate-pulse rounded-lg" />,
});

interface ProductAnalysisTabsProps {
  productId: number;
  locale: string;
  aiReview?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  aiReviewUpdatedAt?: string | null;
  price?: number | null;
  salePrice?: number | null;
  duration?: number | null;
  actressAvgPricePerMin?: number | null;
  existingTags: string[];
  existingPerformers: string[];
}

interface TabDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export default function ProductAnalysisTabs({
  productId,
  locale,
  aiReview,
  rating,
  reviewCount,
  aiReviewUpdatedAt,
  price,
  salePrice,
  duration,
  actressAvgPricePerMin,
  existingTags,
  existingPerformers,
}: ProductAnalysisTabsProps) {
  const hasAiReview = !!aiReview;
  const hasCostPerformance = !!(price && duration && duration > 0);

  const tabs: TabDef[] = [];

  if (hasAiReview) {
    tabs.push({
      key: 'ai-review',
      label:
        locale === 'ja'
          ? 'AIレビュー'
          : locale === 'ko'
            ? 'AI 리뷰'
            : locale === 'zh' || locale === 'zh-TW'
              ? 'AI評論'
              : 'AI Review',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    });
  }

  // SceneTimeline is always available
  tabs.push({
    key: 'scenes',
    label:
      locale === 'ja' ? 'シーン' : locale === 'ko' ? '장면' : locale === 'zh' || locale === 'zh-TW' ? '場景' : 'Scenes',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  });

  if (hasCostPerformance) {
    tabs.push({
      key: 'cost-performance',
      label:
        locale === 'ja'
          ? 'コスパ'
          : locale === 'ko'
            ? '가성비'
            : locale === 'zh' || locale === 'zh-TW'
              ? '性價比'
              : 'Value',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    });
  }

  // UserContributions always available
  tabs.push({
    key: 'contributions',
    label:
      locale === 'ja'
        ? '投稿'
        : locale === 'ko'
          ? '기여'
          : locale === 'zh' || locale === 'zh-TW'
            ? '投稿'
            : 'Contribute',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        />
      </svg>
    ),
  });

  const [activeTab, setActiveTab] = useState(0);
  // Track which tabs have been visited to keep them mounted
  const [visited, setVisited] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const firstKey = tabs[0]?.key;
    if (firstKey) initial.add(firstKey);
    return initial;
  });

  if (tabs.length === 0) return null;

  const currentKey = tabs[activeTab]?.key;

  const handleTabChange = (i: number) => {
    setActiveTab(i);
    const key = tabs[i]?.key;
    if (key) {
      setVisited((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  };

  return (
    <div className="theme-content theme-border overflow-hidden rounded-lg border shadow-md">
      {/* Tab bar */}
      <div className="scrollbar-hide flex gap-0 overflow-x-auto border-b border-white/10">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(i)}
            className={`flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
              i === activeTab
                ? 'border-b-2 border-fuchsia-400 text-fuchsia-300'
                : 'theme-text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — visited tabs stay mounted but hidden to preserve state */}
      <div className="p-4">
        {hasAiReview && aiReview && visited.has('ai-review') && (
          <div className={currentKey !== 'ai-review' ? 'hidden' : undefined}>
            <EnhancedAiReview
              aiReview={aiReview}
              rating={rating ?? undefined}
              ratingCount={reviewCount ?? undefined}
              locale={locale}
              updatedAt={aiReviewUpdatedAt ?? undefined}
            />
          </div>
        )}

        {visited.has('scenes') && (
          <div className={currentKey !== 'scenes' ? 'hidden' : undefined}>
            <SceneTimeline productId={productId} totalDuration={duration || undefined} locale={locale} />
          </div>
        )}

        {hasCostPerformance && price && duration && duration > 0 && visited.has('cost-performance') && (
          <div className={currentKey !== 'cost-performance' ? 'hidden' : undefined}>
            <CostPerformanceCard
              price={price}
              salePrice={salePrice}
              duration={duration}
              actressAvgPricePerMin={actressAvgPricePerMin ?? undefined}
              locale={locale}
            />
          </div>
        )}

        {visited.has('contributions') && (
          <div className={currentKey !== 'contributions' ? 'hidden' : undefined}>
            <Suspense fallback={<div className="theme-content h-32 animate-pulse rounded-lg" />}>
              <UserContributionsWrapper
                productId={productId}
                locale={locale}
                existingTags={existingTags}
                existingPerformers={existingPerformers}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
