'use client';

import { useState, memo } from 'react';
import { Bot, Star, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Sparkles, AlertCircle, Film, Mic, Theater } from 'lucide-react';

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
    // Category ratings
    performance: '演技',
    visuals: '映像',
    audio: '音声',
    story: 'ストーリー',
    performanceDesc: '自然さ・表現力',
    visualsDesc: '照明・アングル',
    audioDesc: '収録品質・BGM',
    storyDesc: '構成・展開',
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
    // Category ratings
    performance: 'Performance',
    visuals: 'Visuals',
    audio: 'Audio',
    story: 'Story',
    performanceDesc: 'Naturalness & Expression',
    visualsDesc: 'Lighting & Angles',
    audioDesc: 'Recording Quality & BGM',
    storyDesc: 'Structure & Flow',
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
    // Category ratings
    performance: '演技',
    visuals: '影像',
    audio: '音频',
    story: '剧情',
    performanceDesc: '自然度・表现力',
    visualsDesc: '灯光・角度',
    audioDesc: '录制质量・背景音乐',
    storyDesc: '结构・发展',
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
    // Category ratings
    performance: '연기',
    visuals: '영상',
    audio: '음성',
    story: '스토리',
    performanceDesc: '자연스러움・표현력',
    visualsDesc: '조명・앵글',
    audioDesc: '녹음 품질・BGM',
    storyDesc: '구성・전개',
  },
} as const;

interface EnhancedAiReviewProps {
  aiReview: string | null;
  rating?: number;
  ratingCount?: number;
  locale: string;
  className?: string;
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
  const lines = review.split('\n').filter(l => l.trim());

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

    // Check for section headers
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

    // Parse category ratings (演技: 4.5, 映像: 4.0, etc.)
    const categoryMatch = trimmed.match(/^(演技|映像|音声|ストーリー|Performance|Visuals|Audio|Story)[：:]\s*(\d+\.?\d*)/i);
    if (categoryMatch) {
      const categoryMap: Record<string, CategoryRating['category']> = {
        '演技': 'performance',
        'performance': 'performance',
        '映像': 'visuals',
        'visuals': 'visuals',
        '音声': 'audio',
        'audio': 'audio',
        'ストーリー': 'story',
        'story': 'story',
      };
      const category = categoryMap[categoryMatch[1].toLowerCase()];
      if (category) {
        const score = parseFloat(categoryMatch[2]);
        const commentMatch = trimmed.match(/[：:]\s*\d+\.?\d*\s*[（(]([^）)]+)[）)]/);
        result.categoryRatings.push({
          category,
          score: Math.min(5, Math.max(0, score)),
          comment: commentMatch ? commentMatch[1] : undefined,
        });
      }
      continue;
    }

    // Parse bullet points
    if (trimmed.startsWith('・') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
      const content = trimmed.replace(/^[・\-•]\s*/, '');
      if (currentSection === 'highlights') {
        result.highlights.push(content);
      } else if (currentSection === 'cautions') {
        result.cautions.push(content);
      } else if (currentSection === 'recommendedFor') {
        result.recommendedFor.push(content);
      } else if (currentSection === 'notRecommendedFor') {
        result.notRecommendedFor.push(content);
      }
    } else if (currentSection === 'summary') {
      summaryLines.push(trimmed);
    }
  }

  result.summary = summaryLines.join(' ').slice(0, 300);

  // If parsing didn't find structured content, use the raw text
  if (result.highlights.length === 0 && result.summary.length === 0) {
    result.summary = review.slice(0, 300);
  }

  // Extract overall score if mentioned
  const scoreMatch = review.match(/総合[評点]?[：:]\s*★+|総合[評点]?[：:]\s*(\d+\.?\d*)\/5|★+|(\d+\.?\d*)\/5|(\d+\.?\d*)点/);
  if (scoreMatch) {
    if (scoreMatch[0].includes('★')) {
      const stars = (scoreMatch[0].match(/★/g) || []).length;
      result.overallScore = stars;
    } else {
      result.overallScore = parseFloat(scoreMatch[1] || scoreMatch[2] || scoreMatch[3] || '4');
    }
  }

  // Generate category ratings from analysis if not explicitly provided
  if (result.categoryRatings.length === 0 && result.summary) {
    // Estimate scores based on keywords in the review
    const hasPerformanceKeywords = /演技|自然|表現|emotion|acting|natural/i.test(review);
    const hasVisualsKeywords = /映像|画質|照明|美しい|visual|lighting|angle/i.test(review);
    const hasAudioKeywords = /音|収録|BGM|クリア|audio|sound|clear/i.test(review);
    const hasStoryKeywords = /ストーリー|展開|構成|story|plot|flow/i.test(review);

    const baseScore = result.overallScore;
    if (hasPerformanceKeywords) {
      result.categoryRatings.push({ category: 'performance', score: Math.min(5, baseScore + 0.1) });
    }
    if (hasVisualsKeywords) {
      result.categoryRatings.push({ category: 'visuals', score: Math.min(5, baseScore - 0.1) });
    }
    if (hasAudioKeywords) {
      result.categoryRatings.push({ category: 'audio', score: Math.min(5, baseScore + 0.15) });
    }
    if (hasStoryKeywords) {
      result.categoryRatings.push({ category: 'story', score: Math.min(5, baseScore - 0.05) });
    }
  }

  return result;
}

// Memoized list item components to prevent unnecessary re-renders
const HighlightItem = memo(function HighlightItem({ text }: { text: string }) {
  return (
    <li className="text-sm text-gray-600 flex items-start gap-2">
      <span className="text-green-500 mt-0.5">•</span>
      {text}
    </li>
  );
});

const CautionItem = memo(function CautionItem({ text }: { text: string }) {
  return (
    <li className="text-sm text-gray-600 flex items-start gap-2">
      <span className="text-yellow-500 mt-0.5">•</span>
      {text}
    </li>
  );
});

const RecommendationItem = memo(function RecommendationItem({ text }: { text: string }) {
  return <li>• {text}</li>;
});

function StarRating({ score, maxScore = 5, size = 'md' }: { score: number; maxScore?: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(maxScore)].map((_, i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i < Math.round(score)
              ? 'text-yellow-500 fill-yellow-500'
              : 'text-gray-300'
          }`}
        />
      ))}
      {size === 'md' && <span className="ml-2 text-gray-900 font-medium">{score.toFixed(1)}</span>}
    </div>
  );
}

function CategoryRatingBar({
  category,
  score,
  comment,
  locale
}: CategoryRating & { locale: string }) {
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const icons: Record<CategoryRating['category'], React.ReactNode> = {
    performance: <Theater className="w-4 h-4" />,
    visuals: <Film className="w-4 h-4" />,
    audio: <Mic className="w-4 h-4" />,
    story: <Bot className="w-4 h-4" />,
  };

  const categoryLabels: Record<CategoryRating['category'], string> = {
    performance: t.performance,
    visuals: t.visuals,
    audio: t.audio,
    story: t.story,
  };

  const categoryDescs: Record<CategoryRating['category'], string> = {
    performance: t.performanceDesc,
    visuals: t.visualsDesc,
    audio: t.audioDesc,
    story: t.storyDesc,
  };

  const percentage = (score / 5) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700">
          {icons[category]}
          <span className="text-sm font-medium">{categoryLabels[category]}</span>
          <span className="text-xs text-gray-400">({categoryDescs[category]})</span>
        </div>
        <span className="text-sm font-medium text-gray-900">{score.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-linear-to-r from-pink-500 to-rose-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {comment && (
        <p className="text-xs text-gray-500 pl-6">{comment}</p>
      )}
    </div>
  );
}

export default function EnhancedAiReview({
  aiReview,
  rating,
  ratingCount,
  locale,
  className = '',
}: EnhancedAiReviewProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [isExpanded, setIsExpanded] = useState(false);

  if (!aiReview) {
    return null;
  }

  const parsed = parseAiReview(aiReview);
  const displayScore = rating || parsed.overallScore;

  return (
    <div className={`bg-white rounded-lg p-4 shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-500" />
          {t.title}
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Sparkles className="w-3 h-3" />
          {t.aiGenerated}
        </div>
      </div>

      {/* Overall Rating */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t.overallRating}</span>
          <StarRating score={displayScore} />
        </div>
        {ratingCount && (
          <p className="text-xs text-gray-400 mt-1">
            {ratingCount} reviews
          </p>
        )}
      </div>

      {/* Category Ratings */}
      {parsed.categoryRatings.length > 0 && (
        <div className="mb-4 space-y-3">
          {parsed.categoryRatings.map((cr) => (
            <CategoryRatingBar
              key={cr.category}
              {...cr}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {parsed.summary && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">{t.summary}</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            {isExpanded ? parsed.summary : parsed.summary.slice(0, 150) + (parsed.summary.length > 150 ? '...' : '')}
          </p>
        </div>
      )}

      {/* Highlights & Cautions */}
      {isExpanded && (
        <>
          {parsed.highlights.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <ThumbsUp className="w-4 h-4 text-green-500" />
                {t.highlights}
              </h4>
              <ul className="space-y-1">
                {parsed.highlights.map((highlight, index) => (
                  <HighlightItem key={index} text={highlight} />
                ))}
              </ul>
            </div>
          )}

          {parsed.cautions.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                {t.cautions}
              </h4>
              <ul className="space-y-1">
                {parsed.cautions.map((caution, index) => (
                  <CautionItem key={index} text={caution} />
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div className="grid grid-cols-2 gap-3">
            {parsed.recommendedFor.length > 0 && (
              <div className="p-2 bg-green-50 rounded-lg">
                <h4 className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" />
                  {t.recommendedFor}
                </h4>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {parsed.recommendedFor.map((item, index) => (
                    <RecommendationItem key={index} text={item} />
                  ))}
                </ul>
              </div>
            )}
            {parsed.notRecommendedFor.length > 0 && (
              <div className="p-2 bg-red-50 rounded-lg">
                <h4 className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                  <ThumbsDown className="w-3 h-3" />
                  {t.notRecommendedFor}
                </h4>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {parsed.notRecommendedFor.map((item, index) => (
                    <RecommendationItem key={index} text={item} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            {t.showLess}
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            {t.showMore}
          </>
        )}
      </button>
    </div>
  );
}
