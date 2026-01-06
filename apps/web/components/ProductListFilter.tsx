'use client';

import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import { useTransition, useMemo } from 'react';
import { providerMeta } from '@/lib/providers';
import {
  HIRAGANA_GROUPS,
  ALPHABET,
  ASP_DISPLAY_ORDER,
  ASP_TO_PROVIDER_ID,
} from '@/lib/constants/filters';
import { useSite } from '@/lib/contexts/SiteContext';

// Static accent color mappings - moved outside component to prevent re-creation on each render
const accentClasses = {
  rose: {
    bg: 'bg-rose-600',
    bgLight: 'bg-rose-600/30',
    ring: 'ring-rose-500',
    text: 'text-rose-500',
    border: 'border-rose-500/50',
  },
  yellow: {
    bg: 'bg-yellow-600',
    bgLight: 'bg-yellow-600/30',
    ring: 'ring-yellow-400',
    text: 'text-yellow-500',
    border: 'border-yellow-500/50',
  },
  blue: {
    bg: 'bg-blue-600',
    bgLight: 'bg-blue-600/30',
    ring: 'ring-blue-500',
    text: 'text-blue-500',
    border: 'border-blue-500/50',
  },
} as const;

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
  ja: {
    filterSettings: 'フィルター設定',
    loading: '読み込み中...',
    initialSearch: '頭文字検索',
    other: '他',
    productPattern: '品番パターン',
    sampleContent: 'サンプルコンテンツ',
    hasVideo: 'サンプル動画あり',
    hasImage: 'サンプル画像あり',
    performerType: '出演形態',
    solo: '単体出演',
    multi: '複数出演',
    genre: 'ジャンル',
    include: '対象',
    exclude: '除外',
    distributionSite: '配信サイト',
    clear: 'クリア',
    saleFilter: 'セール',
    onSaleOnly: 'セール中のみ',
    uncategorizedFilter: '未整理作品',
    uncategorizedOnly: '出演者なしの作品のみ',
    reviewFilter: 'レビュー',
    hasReviewOnly: 'レビューありのみ',
    mgsProductType: 'MGS商品タイプ',
    streaming: '配信',
    dvd: 'DVD',
    monthly: '月額',
  },
  en: {
    filterSettings: 'Filter Settings',
    loading: 'Loading...',
    initialSearch: 'Initial Search',
    other: 'Other',
    productPattern: 'Product Pattern',
    sampleContent: 'Sample Content',
    hasVideo: 'Has Sample Video',
    hasImage: 'Has Sample Image',
    performerType: 'Performer Type',
    solo: 'Solo',
    multi: 'Multiple',
    genre: 'Genre',
    include: 'Include',
    exclude: 'Exclude',
    distributionSite: 'Distribution Site',
    clear: 'Clear',
    saleFilter: 'Sale',
    onSaleOnly: 'On Sale Only',
    uncategorizedFilter: 'Uncategorized',
    uncategorizedOnly: 'Without performer only',
    reviewFilter: 'Review',
    hasReviewOnly: 'With Review Only',
    mgsProductType: 'MGS Product Type',
    streaming: 'Streaming',
    dvd: 'DVD',
    monthly: 'Monthly',
  },
  zh: {
    filterSettings: '筛选设置',
    loading: '加载中...',
    initialSearch: '首字母搜索',
    other: '其他',
    productPattern: '产品编号模式',
    sampleContent: '示例内容',
    hasVideo: '有示例视频',
    hasImage: '有示例图片',
    performerType: '出演类型',
    solo: '单人出演',
    multi: '多人出演',
    genre: '类型',
    include: '包含',
    exclude: '排除',
    distributionSite: '分发站点',
    clear: '清除',
    saleFilter: '促销',
    onSaleOnly: '仅限促销商品',
    uncategorizedFilter: '未整理作品',
    uncategorizedOnly: '仅无演员作品',
    reviewFilter: '评论',
    hasReviewOnly: '仅有评论',
    mgsProductType: 'MGS商品类型',
    streaming: '流媒体',
    dvd: 'DVD',
    monthly: '月费',
  },
  ko: {
    filterSettings: '필터 설정',
    loading: '로딩 중...',
    initialSearch: '첫 글자 검색',
    other: '기타',
    productPattern: '제품 패턴',
    sampleContent: '샘플 콘텐츠',
    hasVideo: '샘플 동영상 있음',
    hasImage: '샘플 이미지 있음',
    performerType: '출연 형태',
    solo: '단독 출연',
    multi: '다수 출연',
    genre: '장르',
    include: '포함',
    exclude: '제외',
    distributionSite: '배포 사이트',
    clear: '지우기',
    saleFilter: '세일',
    onSaleOnly: '세일 상품만',
    uncategorizedFilter: '미정리 작품',
    uncategorizedOnly: '출연자 없는 작품만',
    reviewFilter: '리뷰',
    hasReviewOnly: '리뷰가 있는 것만',
    mgsProductType: 'MGS 상품 유형',
    streaming: '스트리밍',
    dvd: 'DVD',
    monthly: '월정액',
  },
} as const;

interface PatternStat {
  pattern: string;
  label: string;
  count: number;
}

interface AspStat {
  aspName: string;
  count: number;
}

interface Tag {
  id: number;
  name: string;
  count: number;
}

interface ProductListFilterProps {
  patternStats?: PatternStat[];
  aspStats?: AspStat[];
  genreTags?: Tag[];
  showInitialFilter?: boolean;
  showPatternFilter?: boolean;
  showGenreFilter?: boolean;
  showAspFilter?: boolean;
  showSampleFilter?: boolean;
  showPerformerTypeFilter?: boolean;
  showSaleFilter?: boolean;
  showUncategorizedFilter?: boolean;
  showReviewFilter?: boolean;
  showMgsProductTypeFilter?: boolean;
  accentColor?: 'rose' | 'yellow' | 'blue';
  defaultOpen?: boolean;
}

export default function ProductListFilter({
  patternStats = [],
  aspStats = [],
  genreTags = [],
  showInitialFilter = true,
  showPatternFilter = true,
  showGenreFilter = true,
  showAspFilter = true,
  showSampleFilter = true,
  showPerformerTypeFilter = true,
  showSaleFilter = true,
  showUncategorizedFilter = false,
  showReviewFilter = false,
  showMgsProductTypeFilter = true,
  accentColor = 'yellow',
  defaultOpen,
}: ProductListFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const { isFanzaSite } = useSite();

  // FANZAサイトではASPフィルターを非表示にする
  const shouldShowAspFilter = showAspFilter && !isFanzaSite;

  // FANZA以外のASP統計のみ表示（FANZAは規約により除外）
  // ASP_DISPLAY_ORDERの順序に従ってソート
  const filteredAspStats = aspStats
    .filter(asp => asp.aspName !== 'FANZA')
    .sort((a, b) => {
      const aIndex = ASP_DISPLAY_ORDER.indexOf(a.aspName as typeof ASP_DISPLAY_ORDER[number]);
      const bIndex = ASP_DISPLAY_ORDER.indexOf(b.aspName as typeof ASP_DISPLAY_ORDER[number]);
      // 順序リストにないものは末尾に
      const aOrder = aIndex === -1 ? 999 : aIndex;
      const bOrder = bIndex === -1 ? 999 : bIndex;
      return aOrder - bOrder;
    });

  // 現在のフィルター状態を取得
  const hasVideo = searchParams.get('hasVideo') === 'true';
  const hasImage = searchParams.get('hasImage') === 'true';
  const onSale = searchParams.get('onSale') === 'true';
  const uncategorized = searchParams.get('uncategorized') === 'true';
  const hasReview = searchParams.get('hasReview') === 'true';
  const performerType = searchParams.get('performerType') as 'solo' | 'multi' | null;
  const selectedPattern = searchParams.get('pattern') || '';
  const initialFilter = searchParams.get('initial') || '';
  const mgsProductType = searchParams.get('mgsProductType') as 'haishin' | 'dvd' | 'monthly' | null;

  // 配列パースをuseMemoで最適化
  const { includeAsps, excludeAsps, includeTags, excludeTags } = useMemo(() => ({
    includeAsps: searchParams.get('includeAsp')?.split(',').filter(Boolean) || [],
    excludeAsps: searchParams.get('excludeAsp')?.split(',').filter(Boolean) || [],
    includeTags: searchParams.get('include')?.split(',').filter(Boolean) || [],
    excludeTags: searchParams.get('exclude')?.split(',').filter(Boolean) || [],
  }), [searchParams]);

  // アクセントカラー
  const accent = accentClasses[accentColor];

  // フィルター更新関数
  const updateFilter = (key: string, value: string | null, isArray = false, currentArray: string[] = []) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // フィルター変更時はページをリセット

    if (isArray) {
      if (value === null) {
        params.delete(key);
      } else {
        const newArray = currentArray.includes(value)
          ? currentArray.filter(v => v !== value)
          : [...currentArray, value];

        if (newArray.length === 0) {
          params.delete(key);
        } else {
          params.set(key, newArray.join(','));
        }
      }
    } else {
      if (value === null || value === 'false' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  // 頭文字フィルター変更ハンドラー
  const handleInitialChange = (initial: string | null) => {
    updateFilter('initial', initial);
  };

  // パターンフィルター変更ハンドラー
  const handlePatternChange = (pattern: string) => {
    updateFilter('pattern', selectedPattern === pattern ? null : pattern);
  };

  // チェックボックス変更ハンドラー
  const handleVideoChange = () => {
    updateFilter('hasVideo', hasVideo ? null : 'true');
  };

  const handleImageChange = () => {
    updateFilter('hasImage', hasImage ? null : 'true');
  };

  const handleSaleChange = () => {
    updateFilter('onSale', onSale ? null : 'true');
  };

  const handleUncategorizedChange = () => {
    updateFilter('uncategorized', uncategorized ? null : 'true');
  };

  const handleReviewChange = () => {
    updateFilter('hasReview', hasReview ? null : 'true');
  };

  const handlePerformerTypeChange = (type: 'solo' | 'multi' | null) => {
    updateFilter('performerType', performerType === type ? null : type);
  };

  const handleIncludeAspChange = (aspId: string) => {
    updateFilter('includeAsp', aspId, true, includeAsps);
  };

  const handleExcludeAspChange = (aspId: string) => {
    updateFilter('excludeAsp', aspId, true, excludeAsps);
  };

  const handleIncludeTagChange = (tagId: string) => {
    updateFilter('include', tagId, true, includeTags);
  };

  const handleExcludeTagChange = (tagId: string) => {
    updateFilter('exclude', tagId, true, excludeTags);
  };

  const handleMgsProductTypeChange = (type: 'haishin' | 'dvd' | 'monthly' | null) => {
    updateFilter('mgsProductType', mgsProductType === type ? null : type);
  };

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('hasVideo');
    params.delete('hasImage');
    params.delete('onSale');
    params.delete('uncategorized');
    params.delete('hasReview');
    params.delete('performerType');
    params.delete('pattern');
    params.delete('initial');
    params.delete('includeAsp');
    params.delete('excludeAsp');
    params.delete('include');
    params.delete('exclude');
    params.delete('mgsProductType');
    params.delete('page');

    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  const hasActiveFilters =
    hasVideo ||
    hasImage ||
    onSale ||
    uncategorized ||
    hasReview ||
    performerType !== null ||
    selectedPattern !== '' ||
    initialFilter !== '' ||
    includeAsps.length > 0 ||
    excludeAsps.length > 0 ||
    includeTags.length > 0 ||
    excludeTags.length > 0 ||
    mgsProductType !== null;

  const activeFilterCount =
    (hasVideo ? 1 : 0) +
    (hasImage ? 1 : 0) +
    (onSale ? 1 : 0) +
    (uncategorized ? 1 : 0) +
    (hasReview ? 1 : 0) +
    (performerType ? 1 : 0) +
    (selectedPattern ? 1 : 0) +
    (initialFilter ? 1 : 0) +
    includeAsps.length +
    excludeAsps.length +
    includeTags.length +
    excludeTags.length +
    (mgsProductType ? 1 : 0);

  return (
    <details
      className="mb-3 sm:mb-8 bg-gray-800 rounded-lg border border-gray-700"
      open={defaultOpen ?? hasActiveFilters}
    >
      <summary className="px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer font-semibold text-white hover:bg-gray-750 active:bg-gray-700 flex items-center justify-between min-h-[44px] sm:min-h-0 select-none">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm sm:text-base">{t.filterSettings}</span>
        </div>
        {hasActiveFilters && (
          <span className={`text-xs ${accent.bg} text-white px-2 py-0.5 rounded-full font-medium`}>
            {activeFilterCount}
          </span>
        )}
      </summary>
      <div className={`px-3 sm:px-4 pb-3 sm:pb-4 space-y-4 sm:space-y-6 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* ローディングインジケーター */}
        {isPending && (
          <div className="flex items-center justify-center py-2">
            <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${accent.border} mr-2`} />
            <span className="text-sm text-gray-400">{t.loading}</span>
          </div>
        )}

        {/* 頭文字検索 */}
        {showInitialFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.initialSearch}</h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {/* ひらがなグループ */}
              {Object.entries(HIRAGANA_GROUPS).map(([group, chars]) => (
                <div key={group} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleInitialChange(chars[0])}
                    className={`px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium transition-colors ${
                      chars.some(c => initialFilter === c)
                        ? `${accent.bg} text-white`
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {group}
                  </button>
                  {/* ドロップダウン */}
                  <div className="absolute top-full left-0 pt-1 z-20 hidden group-hover:block">
                    <div className="bg-gray-800 border border-gray-600 rounded shadow-lg p-1.5 flex gap-1">
                      {chars.map((char) => (
                        <button
                          key={char}
                          type="button"
                          onClick={() => handleInitialChange(char)}
                          className={`px-2 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                            initialFilter === char
                              ? `${accent.bg} text-white`
                              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {/* アルファベット */}
              {ALPHABET.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleInitialChange(char)}
                  className={`px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium transition-colors ${
                    initialFilter === char
                      ? `${accent.bg} text-white`
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {char}
                </button>
              ))}
              {/* その他 */}
              <button
                type="button"
                onClick={() => handleInitialChange('etc')}
                className={`px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium transition-colors ${
                  initialFilter === 'etc'
                    ? `${accent.bg} text-white`
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {t.other}
              </button>
              {/* クリア */}
              {initialFilter && (
                <button
                  type="button"
                  onClick={() => handleInitialChange(null)}
                  className="px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium bg-gray-600 text-gray-200 hover:bg-gray-500 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* 品番パターンフィルター */}
        {showPatternFilter && patternStats.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.productPattern}</h3>
            <div className="flex flex-wrap gap-2">
              {patternStats.map((stat) => {
                const isSelected = selectedPattern === stat.pattern;
                return (
                  <button
                    key={stat.pattern}
                    onClick={() => handlePatternChange(stat.pattern)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? `${accent.bg} text-white ring-2 ${accent.ring}`
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {stat.label}
                    <span className="ml-1.5 text-xs opacity-80">({stat.count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* サンプルコンテンツフィルター */}
        {showSampleFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.sampleContent}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                hasVideo ? `${accent.bgLight} ${accent.border} hover:opacity-80` : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={hasVideo}
                  onChange={handleVideoChange}
                  className={`w-5 h-5 rounded border-gray-500 ${accent.text} focus:${accent.ring}`}
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${accent.text} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.hasVideo}</span>
              </label>
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                hasImage ? 'bg-blue-600/30 border-blue-500/50 hover:bg-blue-600/40' : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={hasImage}
                  onChange={handleImageChange}
                  className="w-5 h-5 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                />
                <svg className="w-6 h-6 sm:w-5 sm:h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.hasImage}</span>
              </label>
            </div>
          </div>
        )}

        {/* 出演形態フィルター */}
        {showPerformerTypeFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.performerType}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handlePerformerTypeChange('solo')}
                className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                  performerType === 'solo'
                    ? `${accent.bgLight} ${accent.border} hover:opacity-80`
                    : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
                }`}
              >
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${performerType === 'solo' ? accent.text : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.solo}</span>
              </button>
              <button
                type="button"
                onClick={() => handlePerformerTypeChange('multi')}
                className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                  performerType === 'multi'
                    ? 'bg-purple-600/30 border-purple-500/50 hover:opacity-80'
                    : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
                }`}
              >
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${performerType === 'multi' ? 'text-purple-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.multi}</span>
              </button>
            </div>
          </div>
        )}

        {/* MGS商品タイプフィルター */}
        {showMgsProductTypeFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.mgsProductType}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handleMgsProductTypeChange('haishin')}
                className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                  mgsProductType === 'haishin'
                    ? 'bg-green-600/30 border-green-500/50 hover:opacity-80'
                    : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
                }`}
              >
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${mgsProductType === 'haishin' ? 'text-green-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.streaming}</span>
              </button>
              <button
                type="button"
                onClick={() => handleMgsProductTypeChange('dvd')}
                className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                  mgsProductType === 'dvd'
                    ? 'bg-amber-600/30 border-amber-500/50 hover:opacity-80'
                    : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
                }`}
              >
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${mgsProductType === 'dvd' ? 'text-amber-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.dvd}</span>
              </button>
              <button
                type="button"
                onClick={() => handleMgsProductTypeChange('monthly')}
                className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                  mgsProductType === 'monthly'
                    ? 'bg-purple-600/30 border-purple-500/50 hover:opacity-80'
                    : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
                }`}
              >
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${mgsProductType === 'monthly' ? 'text-purple-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.monthly}</span>
              </button>
            </div>
          </div>
        )}

        {/* セールフィルター */}
        {showSaleFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.saleFilter}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                onSale ? 'bg-red-600/30 border-red-500/50 hover:opacity-80' : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={onSale}
                  onChange={handleSaleChange}
                  className="w-5 h-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${onSale ? 'text-red-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.onSaleOnly}</span>
              </label>
            </div>
          </div>
        )}

        {/* 未整理作品フィルター */}
        {showUncategorizedFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.uncategorizedFilter}</h3>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                uncategorized ? `${accent.bgLight} hover:opacity-80` : 'hover:bg-gray-700 active:bg-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={uncategorized}
                  onChange={handleUncategorizedChange}
                  className="w-5 h-5 rounded border-gray-500 text-orange-600 focus:ring-orange-500"
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${uncategorized ? 'text-orange-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.uncategorizedOnly}</span>
              </label>
            </div>
          </div>
        )}

        {/* レビューフィルター */}
        {showReviewFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.reviewFilter}</h3>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                hasReview ? `${accent.bgLight} hover:opacity-80` : 'hover:bg-gray-700 active:bg-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={hasReview}
                  onChange={handleReviewChange}
                  className="w-5 h-5 rounded border-gray-500 text-purple-600 focus:ring-purple-500"
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${hasReview ? 'text-purple-500' : 'text-gray-400'} shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="text-base sm:text-sm text-gray-200">{t.hasReviewOnly}</span>
              </label>
            </div>
          </div>
        )}

        {/* ジャンルタグフィルター */}
        {showGenreFilter && genreTags.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.genre}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750 [-webkit-overflow-scrolling:touch]">
                  {genreTags.map((tag) => (
                    <label
                      key={`include-genre-${tag.id}`}
                      className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                        includeTags.includes(String(tag.id))
                          ? `${accent.bgLight} hover:opacity-80`
                          : 'hover:bg-gray-700 active:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={includeTags.includes(String(tag.id))}
                        onChange={() => handleIncludeTagChange(String(tag.id))}
                        className={`w-5 h-5 rounded border-gray-500 ${accent.text} focus:${accent.ring}`}
                      />
                      <span className="text-base sm:text-sm text-gray-200">{tag.name} <span className="text-gray-400">({tag.count})</span></span>
                    </label>
                  ))}
                </div>
              </div>
              {/* 除外フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750 [-webkit-overflow-scrolling:touch]">
                  {genreTags.map((tag) => (
                    <label
                      key={`exclude-genre-${tag.id}`}
                      className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                        excludeTags.includes(String(tag.id))
                          ? 'bg-red-600/30 hover:bg-red-600/40'
                          : 'hover:bg-gray-700 active:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={excludeTags.includes(String(tag.id))}
                        onChange={() => handleExcludeTagChange(String(tag.id))}
                        className="w-5 h-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-base sm:text-sm text-gray-200">{tag.name} <span className="text-gray-400">({tag.count})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配信サイト（ASP）フィルター - FANZAサイトでは非表示、FANZAは規約により除外 */}
        {shouldShowAspFilter && filteredAspStats.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.distributionSite}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750">
                  {filteredAspStats.map((asp) => {
                    const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const isSelected = includeAsps.includes(asp.aspName);
                    return (
                      <label
                        key={`include-asp-${asp.aspName}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? `${accent.bgLight} ring-2 ${accent.ring}` : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleIncludeAspChange(asp.aspName)}
                          className={`w-5 h-5 rounded border-gray-500 ${accent.text} focus:${accent.ring}`}
                        />
                        <span
                          className="text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded text-white"
                          style={{ background: meta?.gradientColors ? `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})` : 'linear-gradient(to right, #4b5563, #374151)' }}
                        >
                          {meta?.label || asp.aspName}
                          <span className="ml-1.5 sm:ml-1 text-sm sm:text-xs opacity-80">({asp.count.toLocaleString()})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {/* 除外フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750">
                  {filteredAspStats.map((asp) => {
                    const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const isSelected = excludeAsps.includes(asp.aspName);
                    return (
                      <label
                        key={`exclude-asp-${asp.aspName}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-red-600/30 ring-2 ring-red-500' : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleExcludeAspChange(asp.aspName)}
                          className="w-5 h-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                        />
                        <span
                          className="text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded text-white"
                          style={{ background: meta?.gradientColors ? `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})` : 'linear-gradient(to right, #4b5563, #374151)' }}
                        >
                          {meta?.label || asp.aspName}
                          <span className="ml-1.5 sm:ml-1 text-sm sm:text-xs opacity-80">({asp.count.toLocaleString()})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* クリアボタン */}
        {hasActiveFilters && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-none text-center px-6 py-3.5 sm:py-2 border border-gray-600 text-gray-200 rounded-lg sm:rounded-md font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors min-h-[52px] sm:min-h-0"
            >
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
