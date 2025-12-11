'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { providerMeta } from '@/lib/providers';
import {
  HIRAGANA_GROUPS,
  ALPHABET,
  ASP_TO_PROVIDER_ID,
} from '@/lib/constants/filters';

interface Tag {
  id: number;
  name: string;
  count: number;
}

interface Asp {
  id: string;
  name: string;
}

interface ActressListFilterProps {
  genreTags: Tag[];
  availableAsps: Asp[];
  aspProductCounts: Record<string, number>;
  translations: {
    filterSettings: string;
    initialSearch: string;
    sampleContent: string;
    sampleVideo: string;
    sampleImage: string;
    genre: string;
    site: string;
    include: string;
    exclude: string;
    clear: string;
    loading: string;
    other: string;
    saleFilter?: string;
    onSaleOnly?: string;
    reviewFilter?: string;
    hasReviewOnly?: string;
  };
}

// カップサイズ選択肢
const CUP_SIZES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

// 血液型選択肢
const BLOOD_TYPES = ['A', 'B', 'O', 'AB'];

// 身長範囲（プリセット）
const HEIGHT_RANGES = [
  { label: '150cm未満', min: undefined, max: 149 },
  { label: '150-154cm', min: 150, max: 154 },
  { label: '155-159cm', min: 155, max: 159 },
  { label: '160-164cm', min: 160, max: 164 },
  { label: '165-169cm', min: 165, max: 169 },
  { label: '170cm以上', min: 170, max: undefined },
];

export default function ActressListFilter({
  genreTags,
  availableAsps,
  aspProductCounts,
  translations: t,
}: ActressListFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 現在のフィルター状態を取得
  const hasVideo = searchParams.get('hasVideo') === 'true';
  const hasImage = searchParams.get('hasImage') === 'true';
  const onSale = searchParams.get('onSale') === 'true';
  const hasReview = searchParams.get('hasReview') === 'true';
  const includeTags = searchParams.get('include')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  const includeAsps = searchParams.get('includeAsp')?.split(',').filter(Boolean) || [];
  const excludeAsps = searchParams.get('excludeAsp')?.split(',').filter(Boolean) || [];
  const initialFilter = searchParams.get('initial');

  // 女優特徴フィルター
  const cupSizes = searchParams.get('cup')?.split(',').filter(Boolean) || [];
  const heightMin = searchParams.get('heightMin');
  const heightMax = searchParams.get('heightMax');
  const bloodTypes = searchParams.get('bloodType')?.split(',').filter(Boolean) || [];

  // 頭文字フィルター変更ハンドラー
  const handleInitialChange = (initial: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (initial === null) {
      params.delete('initial');
    } else {
      params.set('initial', initial);
    }
    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

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
      if (value === null || value === 'false') {
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

  const handleReviewChange = () => {
    updateFilter('hasReview', hasReview ? null : 'true');
  };

  const handleIncludeTagChange = (tagId: string) => {
    updateFilter('include', tagId, true, includeTags);
  };

  const handleExcludeTagChange = (tagId: string) => {
    updateFilter('exclude', tagId, true, excludeTags);
  };

  const handleIncludeAspChange = (aspId: string) => {
    updateFilter('includeAsp', aspId, true, includeAsps);
  };

  const handleExcludeAspChange = (aspId: string) => {
    updateFilter('excludeAsp', aspId, true, excludeAsps);
  };

  // カップサイズフィルター
  const handleCupSizeChange = (cup: string) => {
    updateFilter('cup', cup, true, cupSizes);
  };

  // 身長範囲フィルター
  const handleHeightRangeChange = (min: number | undefined, max: number | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');

    if (min !== undefined) {
      params.set('heightMin', String(min));
    } else {
      params.delete('heightMin');
    }

    if (max !== undefined) {
      params.set('heightMax', String(max));
    } else {
      params.delete('heightMax');
    }

    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  // 血液型フィルター
  const handleBloodTypeChange = (bloodType: string) => {
    updateFilter('bloodType', bloodType, true, bloodTypes);
  };

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    // フィルター関連のパラメータのみ削除（qやsortは維持）
    params.delete('hasVideo');
    params.delete('hasImage');
    params.delete('onSale');
    params.delete('hasReview');
    params.delete('include');
    params.delete('exclude');
    params.delete('includeAsp');
    params.delete('excludeAsp');
    params.delete('initial');
    params.delete('cup');
    params.delete('heightMin');
    params.delete('heightMax');
    params.delete('bloodType');
    params.delete('page');

    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  const hasActiveFilters = hasVideo || hasImage || onSale || hasReview || includeTags.length > 0 || excludeTags.length > 0 || includeAsps.length > 0 || excludeAsps.length > 0 || !!initialFilter || cupSizes.length > 0 || !!heightMin || !!heightMax || bloodTypes.length > 0;
  const activeFilterCount = includeTags.length + excludeTags.length + includeAsps.length + excludeAsps.length + (hasVideo ? 1 : 0) + (hasImage ? 1 : 0) + (onSale ? 1 : 0) + (hasReview ? 1 : 0) + (initialFilter ? 1 : 0) + cupSizes.length + (heightMin || heightMax ? 1 : 0) + bloodTypes.length;

  return (
    <details
      className="mb-4 sm:mb-8 bg-white rounded-lg border border-gray-200 shadow-sm"
      open={hasActiveFilters}
    >
      <summary className="px-4 py-4 sm:py-3 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-between h-[56px] sm:h-[44px] select-none">
        <div className="flex items-center gap-3 sm:gap-2">
          <svg className="w-6 h-6 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-base sm:text-sm">{t.filterSettings}</span>
        </div>
        {hasActiveFilters && (
          <span className="text-xs bg-pink-500 text-white px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-full font-medium">
            {activeFilterCount}
          </span>
        )}
      </summary>
      <div className={`px-4 pb-4 space-y-5 sm:space-y-6 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* ローディングインジケーター */}
        {isPending && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500 mr-2" />
            <span className="text-sm text-gray-500">{t.loading}</span>
          </div>
        )}

        {/* 頭文字検索 */}
        <div>
          <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.initialSearch}</h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-1">
            {/* ひらがなグループ */}
            {Object.entries(HIRAGANA_GROUPS).map(([group, chars]) => (
              <div key={group} className="relative group">
                <button
                  type="button"
                  onClick={() => handleInitialChange(chars[0])}
                  className={`px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium transition-colors ${
                    chars.some(c => initialFilter === c)
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
                  }`}
                >
                  {group}
                </button>
                {/* ドロップダウン */}
                <div className="absolute top-full left-0 pt-1 z-20 hidden group-hover:block">
                  <div className="bg-white border border-gray-200 rounded shadow-lg p-1.5 flex gap-1">
                    {chars.map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => handleInitialChange(char)}
                        className={`px-2 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                          initialFilter === char
                            ? 'bg-pink-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
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
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
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
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
              }`}
            >
              {t.other}
            </button>
            {/* クリア */}
            {initialFilter && (
              <button
                type="button"
                onClick={() => handleInitialChange(null)}
                className="px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* サンプルコンテンツフィルター */}
        <div>
          <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.sampleContent}</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
              hasVideo ? 'bg-pink-50 border-pink-300 hover:bg-pink-100' : 'border-gray-200 hover:bg-gray-50 active:bg-gray-100'
            }`}>
              <input
                type="checkbox"
                checked={hasVideo}
                onChange={handleVideoChange}
                className="w-5 h-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
              />
              <svg className="w-6 h-6 sm:w-5 sm:h-5 text-pink-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-base sm:text-sm text-gray-700">{t.sampleVideo}</span>
            </label>
            <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
              hasImage ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' : 'border-gray-200 hover:bg-gray-50 active:bg-gray-100'
            }`}>
              <input
                type="checkbox"
                checked={hasImage}
                onChange={handleImageChange}
                className="w-5 h-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
              />
              <svg className="w-6 h-6 sm:w-5 sm:h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-base sm:text-sm text-gray-700">{t.sampleImage}</span>
            </label>
          </div>
        </div>

        {/* セールフィルター */}
        {t.saleFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.saleFilter}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                onSale ? 'bg-red-50 border-red-300 hover:bg-red-100' : 'border-gray-200 hover:bg-gray-50 active:bg-gray-100'
              }`}>
                <input
                  type="checkbox"
                  checked={onSale}
                  onChange={handleSaleChange}
                  className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${onSale ? 'text-red-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                <span className="text-base sm:text-sm text-gray-700">{t.onSaleOnly}</span>
              </label>
            </div>
          </div>
        )}

        {/* レビューフィルター */}
        {t.reviewFilter && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.reviewFilter}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                hasReview ? 'bg-purple-50 border-purple-300 hover:bg-purple-100' : 'border-gray-200 hover:bg-gray-50 active:bg-gray-100'
              }`}>
                <input
                  type="checkbox"
                  checked={hasReview}
                  onChange={handleReviewChange}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${hasReview ? 'text-purple-500' : 'text-gray-400'} shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="text-base sm:text-sm text-gray-700">{t.hasReviewOnly}</span>
              </label>
            </div>
          </div>
        )}

        {/* 女優特徴フィルター */}
        <div className="space-y-4">
          <h3 className="text-base sm:text-sm font-semibold text-gray-900">女優の特徴</h3>

          {/* カップサイズ */}
          <div>
            <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">カップサイズ</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {CUP_SIZES.map((cup) => (
                <button
                  key={cup}
                  type="button"
                  onClick={() => handleCupSizeChange(cup)}
                  className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-sm font-medium transition-colors ${
                    cupSizes.includes(cup)
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
                  }`}
                >
                  {cup}カップ
                </button>
              ))}
            </div>
          </div>

          {/* 身長 */}
          <div>
            <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">身長</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {HEIGHT_RANGES.map((range, index) => {
                const isSelected = (
                  (range.min === undefined && heightMin === null && range.max !== undefined && heightMax === String(range.max)) ||
                  (range.max === undefined && heightMax === null && range.min !== undefined && heightMin === String(range.min)) ||
                  (range.min !== undefined && range.max !== undefined && heightMin === String(range.min) && heightMax === String(range.max))
                );
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleHeightRangeChange(range.min, range.max)}
                    className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
              {(heightMin || heightMax) && (
                <button
                  type="button"
                  onClick={() => handleHeightRangeChange(undefined, undefined)}
                  className="px-2.5 py-1.5 sm:px-2 sm:py-1 rounded text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 血液型 */}
          <div>
            <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">血液型</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {BLOOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleBloodTypeChange(type)}
                  className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-sm font-medium transition-colors ${
                    bloodTypes.includes(type)
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
                  }`}
                >
                  {type}型
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ジャンルタグ */}
        {genreTags.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.genre}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-200 rounded-lg sm:rounded p-2 bg-gray-50 [-webkit-overflow-scrolling:touch]">
                  {genreTags.map((tag) => (
                    <label
                      key={`include-genre-${tag.id}`}
                      className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                        includeTags.includes(String(tag.id))
                          ? 'bg-pink-100 hover:bg-pink-200'
                          : 'hover:bg-gray-100 active:bg-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={includeTags.includes(String(tag.id))}
                        onChange={() => handleIncludeTagChange(String(tag.id))}
                        className="w-5 h-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
                      />
                      <span className="text-base sm:text-sm text-gray-700">{tag.name} <span className="text-gray-500">({tag.count})</span></span>
                    </label>
                  ))}
                </div>
              </div>
              {/* 除外フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-200 rounded-lg sm:rounded p-2 bg-gray-50 [-webkit-overflow-scrolling:touch]">
                  {genreTags.map((tag) => (
                    <label
                      key={`exclude-genre-${tag.id}`}
                      className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                        excludeTags.includes(String(tag.id))
                          ? 'bg-red-100 hover:bg-red-200'
                          : 'hover:bg-gray-100 active:bg-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={excludeTags.includes(String(tag.id))}
                        onChange={() => handleExcludeTagChange(String(tag.id))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-base sm:text-sm text-gray-700">{tag.name} <span className="text-gray-500">({tag.count})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配信サイト（ASP）フィルター */}
        {availableAsps.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-gray-900 mb-3">{t.site}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-200 rounded-lg sm:rounded p-2 bg-gray-50">
                  {availableAsps.map((asp) => {
                    const providerId = ASP_TO_PROVIDER_ID[asp.id];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const count = aspProductCounts[asp.id];
                    const isSelected = includeAsps.includes(asp.id);
                    return (
                      <label
                        key={`include-asp-${asp.id}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-pink-100 ring-2 ring-pink-400' : 'hover:bg-gray-100 active:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleIncludeAspChange(asp.id)}
                          className="w-5 h-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
                        />
                        <span className={`text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded bg-linear-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}>
                          {meta?.label || asp.name}
                          {count !== undefined && <span className="ml-1.5 sm:ml-1 text-sm sm:text-xs opacity-80">({count.toLocaleString()})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {/* 除外フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-600 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-200 rounded-lg sm:rounded p-2 bg-gray-50">
                  {availableAsps.map((asp) => {
                    const providerId = ASP_TO_PROVIDER_ID[asp.id];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const count = aspProductCounts[asp.id];
                    const isSelected = excludeAsps.includes(asp.id);
                    return (
                      <label
                        key={`exclude-asp-${asp.id}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-red-100 ring-2 ring-red-400' : 'hover:bg-gray-100 active:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleExcludeAspChange(asp.id)}
                          className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className={`text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded bg-linear-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}>
                          {meta?.label || asp.name}
                          {count !== undefined && <span className="ml-1.5 sm:ml-1 text-sm sm:text-xs opacity-80">({count.toLocaleString()})</span>}
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
              className="flex-1 sm:flex-none text-center px-6 py-3 sm:py-2 border border-gray-300 text-gray-700 rounded-lg sm:rounded-md font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
