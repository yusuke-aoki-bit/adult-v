'use client';

import { useState, memo } from 'react';
import {
  Bot,
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  Film,
  Mic,
  Theater,
  CheckCircle2,
} from 'lucide-react';
import { localeMap } from '@adult-v/shared/lib/utils/formatDate';

const translations = {
  ja: {
    title: 'AI分析レビュー',
    overallRating: '総合評価',
    summary: 'サマリー',
    highlights: 'ハイライト',
    cautions: '注意点',
    recommendedFor: 'こんな人におすすめ',
    notRecommendedFor: '向かない人',
    showMore: '詳細を見る',
    showLess: '閉じる',
    aiGenerated: 'AIによる自動生成レビュー',
    noReview: 'AIレビューはまだありません',
    performance: '演技',
    visuals: '映像',
    audio: '音声',
    story: 'ストーリー',
    performanceDesc: '自然さ・表現力',
    visualsDesc: '照明・アングル',
    audioDesc: '収録品質・BGM',
    storyDesc: '構成・展開',
    lastUpdated: '更新日',
    basedOnReviews: '{count}件のユーザーレビューを基に分析',
    basedOnDescription: '商品説明を基に分析',
    trustNote: 'このレビューは参考情報です。実際の内容と異なる場合があります。',
    excellent: '優秀',
    good: '良好',
    average: '普通',
    poor: '要改善',
  },
  en: {
    title: 'AI Analysis Review',
    overallRating: 'Overall Rating',
    summary: 'Summary',
    highlights: 'Highlights',
    cautions: 'Cautions',
    recommendedFor: 'Recommended for',
    notRecommendedFor: 'Not for',
    showMore: 'Show More',
    showLess: 'Show Less',
    aiGenerated: 'AI-generated review',
    noReview: 'No AI review available',
    performance: 'Performance',
    visuals: 'Visuals',
    audio: 'Audio',
    story: 'Story',
    performanceDesc: 'Naturalness & Expression',
    visualsDesc: 'Lighting & Angles',
    audioDesc: 'Recording Quality & BGM',
    storyDesc: 'Structure & Flow',
    lastUpdated: 'Updated',
    basedOnReviews: 'Based on {count} user reviews',
    basedOnDescription: 'Based on product description',
    trustNote: 'This review is for reference only. Actual content may differ.',
    excellent: 'Excellent',
    good: 'Good',
    average: 'Average',
    poor: 'Needs Work',
  },
  zh: {
    title: 'AI分析评论',
    overallRating: '综合评分',
    summary: '概述',
    highlights: '亮点',
    cautions: '注意事项',
    recommendedFor: '推荐给',
    notRecommendedFor: '不适合',
    showMore: '查看更多',
    showLess: '收起',
    aiGenerated: 'AI自动生成评论',
    noReview: '暂无AI评论',
    performance: '演技',
    visuals: '影像',
    audio: '音频',
    story: '剧情',
    performanceDesc: '自然度・表现力',
    visualsDesc: '灯光・角度',
    audioDesc: '录制质量・背景音乐',
    storyDesc: '结构・发展',
    lastUpdated: '更新日期',
    basedOnReviews: '基于{count}条用户评论分析',
    basedOnDescription: '基于商品说明分析',
    trustNote: '此评论仅供参考，实际内容可能有所不同。',
    excellent: '优秀',
    good: '良好',
    average: '一般',
    poor: '待改善',
  },
  'zh-TW': {
    title: 'AI分析評論',
    overallRating: '綜合評分',
    summary: '概述',
    highlights: '亮點',
    cautions: '注意事項',
    recommendedFor: '推薦給',
    notRecommendedFor: '不適合',
    showMore: '查看更多',
    showLess: '收起',
    aiGenerated: 'AI自動生成評論',
    noReview: '暫無AI評論',
    performance: '演技',
    visuals: '影像',
    audio: '音訊',
    story: '劇情',
    performanceDesc: '自然度・表現力',
    visualsDesc: '燈光・角度',
    audioDesc: '錄製品質・背景音樂',
    storyDesc: '結構・發展',
    lastUpdated: '更新日期',
    basedOnReviews: '基於{count}則使用者評論分析',
    basedOnDescription: '基於商品說明分析',
    trustNote: '此評論僅供參考，實際內容可能有所不同。',
    excellent: '優秀',
    good: '良好',
    average: '一般',
    poor: '待改善',
  },
  ko: {
    title: 'AI 분석 리뷰',
    overallRating: '종합 평점',
    summary: '요약',
    highlights: '하이라이트',
    cautions: '주의사항',
    recommendedFor: '추천 대상',
    notRecommendedFor: '비추천 대상',
    showMore: '더보기',
    showLess: '접기',
    aiGenerated: 'AI 자동 생성 리뷰',
    noReview: 'AI 리뷰가 없습니다',
    performance: '연기',
    visuals: '영상',
    audio: '음성',
    story: '스토리',
    performanceDesc: '자연스러움・표현력',
    visualsDesc: '조명・앵글',
    audioDesc: '녹음 품질・BGM',
    storyDesc: '구성・전개',
    lastUpdated: '업데이트',
    basedOnReviews: '{count}개의 사용자 리뷰 기반 분석',
    basedOnDescription: '상품 설명 기반 분석',
    trustNote: '이 리뷰는 참고용입니다. 실제 내용과 다를 수 있습니다.',
    excellent: '우수',
    good: '양호',
    average: '보통',
    poor: '개선 필요',
  },
} as const;

interface EnhancedAiReviewProps {
  aiReview: string | null;
  rating?: number;
  ratingCount?: number;
  locale: string;
  className?: string;
  updatedAt?: string;
}

interface CategoryRating {
  category: 'performance' | 'visuals' | 'audio' | 'story';
  score: number;
  comment?: string;
}

interface ParsedReview {
  summary: string;
  highlights: string[];
  cautions: string[];
  recommendedFor: string[];
  notRecommendedFor: string[];
  overallScore: number;
  categoryRatings: CategoryRating[];
}

function parseAiReview(review: string): ParsedReview {
  const lines = review.split('\n').filter((l) => l.trim());
  const result: ParsedReview = {
    summary: '',
    highlights: [],
    cautions: [],
    recommendedFor: [],
    notRecommendedFor: [],
    overallScore: 4,
    categoryRatings: [],
  };

  let currentSection = 'summary';
  const summaryLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('ハイライト') || trimmed.includes('Highlight') || trimmed.includes('良い点')) {
      currentSection = 'highlights';
      continue;
    }
    if (trimmed.includes('注意') || trimmed.includes('Caution') || trimmed.includes('悪い点')) {
      currentSection = 'cautions';
      continue;
    }
    if (trimmed.includes('おすすめ') || trimmed.includes('Recommend')) {
      currentSection = trimmed.includes('向かない') || trimmed.includes('Not') ? 'notRecommendedFor' : 'recommendedFor';
      continue;
    }

    const categoryMatch = trimmed.match(
      /^(演技|映像|音声|ストーリー|Performance|Visuals|Audio|Story)[：:]\s*(\d+\.?\d*)/i,
    );
    if (categoryMatch) {
      const categoryMap: Record<string, CategoryRating['category']> = {
        演技: 'performance',
        performance: 'performance',
        映像: 'visuals',
        visuals: 'visuals',
        音声: 'audio',
        audio: 'audio',
        ストーリー: 'story',
        story: 'story',
      };
      const category = categoryMap[categoryMatch[1]!.toLowerCase()];
      if (category) {
        const score = parseFloat(categoryMatch[2]!);
        const commentMatch = trimmed.match(/[：:]\s*\d+\.?\d*\s*[（(]([^）)]+)[）)]/);
        result.categoryRatings.push({
          category,
          score: Math.min(5, Math.max(0, score)),
          comment: commentMatch ? commentMatch[1] : undefined,
        });
      }
      continue;
    }

    if (trimmed.startsWith('・') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
      const content = trimmed.replace(/^[・\-•]\s*/, '');
      if (currentSection === 'highlights') result.highlights.push(content);
      else if (currentSection === 'cautions') result.cautions.push(content);
      else if (currentSection === 'recommendedFor') result.recommendedFor.push(content);
      else if (currentSection === 'notRecommendedFor') result.notRecommendedFor.push(content);
    } else if (currentSection === 'summary') {
      summaryLines.push(trimmed);
    }
  }

  result.summary = summaryLines.join(' ').slice(0, 300);
  if (result.highlights.length === 0 && result.summary.length === 0) result.summary = review.slice(0, 300);

  const scoreMatch = review.match(
    /総合[評点]?[：:]\s*★+|総合[評点]?[：:]\s*(\d+\.?\d*)\/5|★+|(\d+\.?\d*)\/5|(\d+\.?\d*)点/,
  );
  if (scoreMatch) {
    if (scoreMatch[0].includes('★')) result.overallScore = (scoreMatch[0].match(/★/g) || []).length;
    else result.overallScore = parseFloat(scoreMatch[1] || scoreMatch[2] || scoreMatch[3] || '4');
  }

  if (result.categoryRatings.length === 0 && result.summary) {
    const baseScore = result.overallScore;
    if (/演技|自然|表現|emotion|acting|natural/i.test(review))
      result.categoryRatings.push({ category: 'performance', score: Math.min(5, baseScore + 0.1) });
    if (/映像|画質|照明|美しい|visual|lighting|angle/i.test(review))
      result.categoryRatings.push({ category: 'visuals', score: Math.min(5, baseScore - 0.1) });
    if (/音|収録|BGM|クリア|audio|sound|clear/i.test(review))
      result.categoryRatings.push({ category: 'audio', score: Math.min(5, baseScore + 0.15) });
    if (/ストーリー|展開|構成|story|plot|flow/i.test(review))
      result.categoryRatings.push({ category: 'story', score: Math.min(5, baseScore - 0.05) });
  }

  return result;
}

// Score color utility
function getScoreColor(score: number): string {
  if (score >= 4.5) return 'var(--score-excellent)';
  if (score >= 3.5) return 'var(--score-good)';
  if (score >= 2.5) return 'var(--score-average)';
  return 'var(--score-poor)';
}

function getScoreLabel(score: number, t: { excellent: string; good: string; average: string; poor: string }): string {
  if (score >= 4.5) return t.excellent;
  if (score >= 3.5) return t.good;
  if (score >= 2.5) return t.average;
  return t.poor;
}

// Circular progress SVG
const CircularScore = memo(function CircularScore({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 5) * circumference;
  const color = getScoreColor(score);

  return (
    <svg width={size} height={size} className="-rotate-90 transform">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="theme-text-muted opacity-20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        className="transition-all duration-700"
      />
    </svg>
  );
});

// Category card for 2x2 grid
const CategoryCard = memo(function CategoryCard({ category, score, locale }: CategoryRating & { locale: string }) {
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const icons: Record<CategoryRating['category'], React.ReactNode> = {
    performance: <Theater className="h-4 w-4" />,
    visuals: <Film className="h-4 w-4" />,
    audio: <Mic className="h-4 w-4" />,
    story: <Bot className="h-4 w-4" />,
  };
  const labels: Record<CategoryRating['category'], string> = {
    performance: t.performance,
    visuals: t.visuals,
    audio: t.audio,
    story: t.story,
  };
  const percentage = (score / 5) * 100;
  const color = getScoreColor(score);

  return (
    <div className="theme-accordion-bg rounded-lg p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="theme-text-muted">{icons[category]}</span>
        <span className="theme-text-secondary text-xs font-medium">{labels[category]}</span>
        <span className="theme-text ml-auto text-sm font-bold">{score.toFixed(1)}</span>
      </div>
      <div className="theme-input-bg h-1.5 w-full rounded-full">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
});

const HighlightItem = memo(function HighlightItem({ text }: { text: string }) {
  return (
    <li className="theme-text-secondary theme-highlight-bg flex items-start gap-2 rounded-md border-l-2 border-emerald-500 px-3 py-1.5 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      {text}
    </li>
  );
});

const CautionItem = memo(function CautionItem({ text }: { text: string }) {
  return (
    <li className="theme-text-secondary theme-caution-bg flex items-start gap-2 rounded-md border-l-2 border-amber-500 px-3 py-1.5 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      {text}
    </li>
  );
});

const RecommendationItem = memo(function RecommendationItem({ text }: { text: string }) {
  return <li className="theme-text-secondary text-xs">• {text}</li>;
});

export default function EnhancedAiReview({
  aiReview,
  rating,
  ratingCount,
  locale,
  className = '',
  updatedAt,
}: EnhancedAiReviewProps) {
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const [isExpanded, setIsExpanded] = useState(false);

  if (!aiReview) return null;

  const parsed = parseAiReview(aiReview);
  const displayScore = rating || parsed.overallScore;
  const scoreColor = getScoreColor(displayScore);
  const scoreLabel = getScoreLabel(displayScore, t);

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString(localeMap[locale] || 'ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const analysisBasis =
    ratingCount && ratingCount > 0 ? t.basedOnReviews.replace('{count}', String(ratingCount)) : t.basedOnDescription;

  return (
    <div className={`theme-content theme-border rounded-xl border p-5 ${className}`}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="theme-text flex items-center gap-2 text-lg font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Bot className="h-5 w-5 text-purple-400" />
          </div>
          {t.title}
        </h3>
        <div className="theme-text-muted flex items-center gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          {t.aiGenerated}
        </div>
      </div>

      {/* Score + Categories - Hero Section */}
      <div className="mb-5 flex flex-col gap-5 sm:flex-row">
        {/* Circular Score */}
        <div className="flex shrink-0 flex-col items-center justify-center">
          <div className="relative h-[100px] w-[100px]">
            <CircularScore score={displayScore} size={100} />
            <div className="absolute inset-0 flex rotate-0 flex-col items-center justify-center">
              <span className="theme-text text-3xl font-bold">{displayScore.toFixed(1)}</span>
              <span className="theme-text-muted text-[10px]">/5.0</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < Math.round(displayScore) ? 'fill-yellow-400 text-yellow-400' : 'theme-text-muted opacity-30'}`}
              />
            ))}
          </div>
          <span className="mt-1 text-xs font-medium" style={{ color: scoreColor }}>
            {scoreLabel}
          </span>
        </div>

        {/* Category Ratings 2x2 Grid */}
        {parsed.categoryRatings.length > 0 && (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            {parsed.categoryRatings.map((cr) => (
              <CategoryCard key={cr.category} {...cr} locale={locale} />
            ))}
          </div>
        )}
      </div>

      {/* Trust Indicators */}
      <div className="theme-accordion-bg theme-text-muted mb-4 rounded-lg p-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {t.lastUpdated}: {formattedDate}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {analysisBasis}
          </span>
        </div>
        <p className="mt-1.5 text-[10px] opacity-60">{t.trustNote}</p>
      </div>

      {/* Summary */}
      {parsed.summary && (
        <div className="mb-4">
          <h4 className="theme-text-muted mb-2 text-sm font-medium">{t.summary}</h4>
          <p className="theme-text-secondary text-sm leading-relaxed">
            {isExpanded ? parsed.summary : parsed.summary.slice(0, 150) + (parsed.summary.length > 150 ? '...' : '')}
          </p>
        </div>
      )}

      {/* Highlights & Cautions */}
      {isExpanded && (
        <>
          {parsed.highlights.length > 0 && (
            <div className="mb-4">
              <h4 className="theme-text-muted mb-2 flex items-center gap-1 text-sm font-medium">
                <ThumbsUp className="h-4 w-4 text-emerald-500" />
                {t.highlights}
              </h4>
              <ul className="space-y-1.5">
                {parsed.highlights.map((h, i) => (
                  <HighlightItem key={i} text={h} />
                ))}
              </ul>
            </div>
          )}

          {parsed.cautions.length > 0 && (
            <div className="mb-4">
              <h4 className="theme-text-muted mb-2 flex items-center gap-1 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                {t.cautions}
              </h4>
              <ul className="space-y-1.5">
                {parsed.cautions.map((c, i) => (
                  <CautionItem key={i} text={c} />
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div className="grid grid-cols-2 gap-3">
            {parsed.recommendedFor.length > 0 && (
              <div className="theme-highlight-bg rounded-lg border-l-2 border-emerald-500 p-3">
                <h4 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <ThumbsUp className="h-3 w-3" />
                  {t.recommendedFor}
                </h4>
                <ul className="space-y-0.5">
                  {parsed.recommendedFor.map((item, i) => (
                    <RecommendationItem key={i} text={item} />
                  ))}
                </ul>
              </div>
            )}
            {parsed.notRecommendedFor.length > 0 && (
              <div className="theme-caution-bg rounded-lg border-l-2 border-amber-500 p-3">
                <h4 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-amber-500">
                  <ThumbsDown className="h-3 w-3" />
                  {t.notRecommendedFor}
                </h4>
                <ul className="space-y-0.5">
                  {parsed.notRecommendedFor.map((item, i) => (
                    <RecommendationItem key={i} text={item} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="theme-text-muted hover:theme-text theme-accordion-hover mt-4 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4" />
            {t.showLess}
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            {t.showMore}
          </>
        )}
      </button>
    </div>
  );
}
