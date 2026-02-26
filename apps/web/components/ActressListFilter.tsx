'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useCallback, useState } from 'react';
import { providerMeta } from '@/lib/providers';
import { HIRAGANA_GROUPS, ALPHABET, ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { FilterPresetManager } from '@adult-v/shared/components';
import { filtersToSearchParams, type FilterValues } from '@adult-v/shared/lib/filter-presets';

interface Tag {
  id: number;
  name: string;
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
    actressFeatures?: string;
    cupSize?: string;
    cupLabel?: string;
    height?: string;
    bloodType?: string;
    bloodTypeLabel?: string;
    debutYear?: string;
    workCount?: string;
    worksOrMore?: string;
    under?: string;
    over?: string;
  };
}

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
  const [openHiraganaGroup, setOpenHiraganaGroup] = useState<string | null>(null);

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
  const debutYear = searchParams.get('debutYear') || '';
  const minWorks = searchParams.get('minWorks') || '';

  // 現在のフィルター値をFilterValues形式で取得
  const currentFilters: FilterValues = {
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    onSale: onSale || undefined,
    hasReview: hasReview || undefined,
    initial: initialFilter || undefined,
    includeTags: includeTags.length > 0 ? includeTags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    includeAsps: includeAsps.length > 0 ? includeAsps : undefined,
    excludeAsps: excludeAsps.length > 0 ? excludeAsps : undefined,
    cupSizes: cupSizes.length > 0 ? cupSizes : undefined,
    heightMin: heightMin ? parseInt(heightMin, 10) : undefined,
    heightMax: heightMax ? parseInt(heightMax, 10) : undefined,
    bloodTypes: bloodTypes.length > 0 ? bloodTypes : undefined,
  };

  // プリセット適用ハンドラー
  const handleApplyPreset = useCallback(
    (filters: FilterValues) => {
      const params = filtersToSearchParams(filters);
      const queryString = params.toString();
      startTransition(() => {
        router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
      });
    },
    [pathname, router],
  );

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
          ? currentArray.filter((v) => v !== value)
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
    params.delete('debutYear');
    params.delete('minWorks');
    params.delete('page');

    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  // Quick filters (sale/video/image/review) are now inline chips — only count advanced filters
  const hasActiveFilters =
    includeTags.length > 0 ||
    excludeTags.length > 0 ||
    includeAsps.length > 0 ||
    excludeAsps.length > 0 ||
    !!initialFilter ||
    cupSizes.length > 0 ||
    !!heightMin ||
    !!heightMax ||
    bloodTypes.length > 0 ||
    !!debutYear ||
    !!minWorks;
  const activeFilterCount =
    includeTags.length +
    excludeTags.length +
    includeAsps.length +
    excludeAsps.length +
    (initialFilter ? 1 : 0) +
    cupSizes.length +
    (heightMin || heightMax ? 1 : 0) +
    bloodTypes.length +
    (debutYear ? 1 : 0) +
    (minWorks ? 1 : 0);

  const [isFilterOpen, setIsFilterOpen] = useState(hasActiveFilters);

  return (
    <details
      className="mb-2 rounded-lg border border-gray-700 bg-gray-800 sm:mb-3"
      open={hasActiveFilters || undefined}
      onToggle={(e) => setIsFilterOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="hover:bg-gray-750 flex h-[56px] cursor-pointer items-center justify-between px-4 py-4 font-semibold text-white select-none active:bg-gray-700 sm:h-[44px] sm:py-3">
        <div className="flex items-center gap-3 sm:gap-2">
          <svg className="h-6 w-6 text-gray-400 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-base sm:text-sm">{t.filterSettings}</span>
        </div>
        {hasActiveFilters && (
          <span className="rounded-full bg-fuchsia-600 px-2.5 py-1 text-xs font-medium text-white sm:px-2 sm:py-0.5">
            {activeFilterCount}
          </span>
        )}
      </summary>
      {isFilterOpen && (
        <div className={`space-y-5 px-4 pb-4 sm:space-y-6 ${isPending ? 'pointer-events-none opacity-60' : ''}`}>
          {/* プリセット管理 + ローディングインジケーター */}
          <div className="flex items-center justify-between">
            <FilterPresetManager currentFilters={currentFilters} onApplyPreset={handleApplyPreset} theme="dark" />
            {isPending && (
              <div className="flex items-center">
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-fuchsia-500" />
                <span className="text-sm text-gray-400">{t.loading}</span>
              </div>
            )}
          </div>

          {/* 頭文字検索 */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-white sm:text-sm">{t.initialSearch}</h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {/* ひらがなグループ */}
              {Object.entries(HIRAGANA_GROUPS).map(([group, chars]) => (
                <div key={group} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenHiraganaGroup((prev) => (prev === group ? null : group))}
                    className={`rounded px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-2 sm:py-1 ${
                      chars.some((c) => initialFilter === c)
                        ? 'bg-fuchsia-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {group}
                  </button>
                  {/* ドロップダウン */}
                  {openHiraganaGroup === group && (
                    <div className="absolute top-full left-0 z-20 pt-1">
                      <div className="flex gap-1 rounded border border-gray-600 bg-gray-800 p-1.5 shadow-lg">
                        {chars.map((char) => (
                          <button
                            key={char}
                            type="button"
                            onClick={() => {
                              handleInitialChange(char);
                              setOpenHiraganaGroup(null);
                            }}
                            className={`rounded px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
                              initialFilter === char
                                ? 'bg-fuchsia-600 text-white'
                                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            }`}
                          >
                            {char}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* アルファベット */}
              {ALPHABET.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleInitialChange(char)}
                  className={`rounded px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-2 sm:py-1 ${
                    initialFilter === char ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {char}
                </button>
              ))}
              {/* その他 */}
              <button
                type="button"
                onClick={() => handleInitialChange('etc')}
                className={`rounded px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-2 sm:py-1 ${
                  initialFilter === 'etc' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {t.other}
              </button>
              {/* クリア */}
              {initialFilter && (
                <button
                  type="button"
                  onClick={() => handleInitialChange(null)}
                  className="rounded bg-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-500 sm:px-2 sm:py-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 女優特徴フィルター */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white sm:text-sm">{t.actressFeatures || '女優の特徴'}</h3>

            {/* カップサイズ */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.cupSize || 'カップサイズ'}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map((cup) => (
                  <button
                    key={cup}
                    type="button"
                    onClick={() => handleCupSizeChange(cup)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 ${
                      cupSizes.includes(cup)
                        ? 'bg-fuchsia-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {cup}
                    {t.cupLabel || 'カップ'}
                  </button>
                ))}
              </div>
            </div>

            {/* 身長 */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.height || '身長'}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {[
                  { label: `${t.under || ''}150cm${t.under ? '' : '未満'}`, min: undefined, max: 149 },
                  { label: '150-154cm', min: 150, max: 154 },
                  { label: '155-159cm', min: 155, max: 159 },
                  { label: '160-164cm', min: 160, max: 164 },
                  { label: '165-169cm', min: 165, max: 169 },
                  { label: `170cm${t.over || '以上'}`, min: 170, max: undefined },
                ].map((range, index) => {
                  const isSelected =
                    (range.min === undefined &&
                      heightMin === null &&
                      range.max !== undefined &&
                      heightMax === String(range.max)) ||
                    (range.max === undefined &&
                      heightMax === null &&
                      range.min !== undefined &&
                      heightMin === String(range.min)) ||
                    (range.min !== undefined &&
                      range.max !== undefined &&
                      heightMin === String(range.min) &&
                      heightMax === String(range.max));
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleHeightRangeChange(range.min, range.max)}
                      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 ${
                        isSelected ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
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
                    className="rounded bg-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-500 sm:px-2 sm:py-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 血液型 */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.bloodType || '血液型'}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {['A', 'B', 'O', 'AB'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleBloodTypeChange(type)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 ${
                      bloodTypes.includes(type)
                        ? 'bg-fuchsia-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {type}
                    {t.bloodTypeLabel || '型'}
                  </button>
                ))}
              </div>
            </div>

            {/* デビュー年 */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.debutYear || 'デビュー年'}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {[
                  { label: '2025~', value: '2025-' },
                  { label: '2022-2024', value: '2022-2024' },
                  { label: '2018-2021', value: '2018-2021' },
                  { label: '2012-2017', value: '2012-2017' },
                  { label: '~2011', value: '-2011' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter('debutYear', debutYear === option.value ? null : option.value)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 ${
                      debutYear === option.value
                        ? 'bg-fuchsia-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {debutYear && (
                  <button
                    type="button"
                    onClick={() => updateFilter('debutYear', null)}
                    className="rounded bg-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-500 sm:px-2 sm:py-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 作品数 */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.workCount || '作品数'}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {[
                  { label: `100${t.worksOrMore || '作品以上'}`, value: '100' },
                  { label: `50${t.worksOrMore || '作品以上'}`, value: '50' },
                  { label: `30${t.worksOrMore || '作品以上'}`, value: '30' },
                  { label: `10${t.worksOrMore || '作品以上'}`, value: '10' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter('minWorks', minWorks === option.value ? null : option.value)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors sm:px-2.5 sm:py-1 ${
                      minWorks === option.value
                        ? 'bg-fuchsia-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {minWorks && (
                  <button
                    type="button"
                    onClick={() => updateFilter('minWorks', null)}
                    className="rounded bg-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-500 sm:px-2 sm:py-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ジャンルタグ */}
          {genreTags.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-white sm:text-sm">{t.genre}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 対象フィルタ */}
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.include}</p>
                  <div className="bg-gray-750 max-h-[280px] space-y-1 overflow-y-auto rounded-lg border border-gray-600 p-2 [-webkit-overflow-scrolling:touch] sm:max-h-72 sm:rounded">
                    {genreTags.map((tag) => (
                      <label
                        key={`include-genre-${tag.id}`}
                        className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors sm:min-h-0 sm:rounded sm:p-1.5 ${
                          includeTags.includes(String(tag.id))
                            ? 'bg-fuchsia-600/30 hover:bg-fuchsia-600/40'
                            : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={includeTags.includes(String(tag.id))}
                          onChange={() => handleIncludeTagChange(String(tag.id))}
                          className="h-5 w-5 rounded border-gray-500 text-fuchsia-600 focus:ring-fuchsia-500"
                        />
                        <span className="text-base text-gray-200 sm:text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* 除外フィルタ */}
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.exclude}</p>
                  <div className="bg-gray-750 max-h-[280px] space-y-1 overflow-y-auto rounded-lg border border-gray-600 p-2 [-webkit-overflow-scrolling:touch] sm:max-h-72 sm:rounded">
                    {genreTags.map((tag) => (
                      <label
                        key={`exclude-genre-${tag.id}`}
                        className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors sm:min-h-0 sm:rounded sm:p-1.5 ${
                          excludeTags.includes(String(tag.id))
                            ? 'bg-red-600/30 hover:bg-red-600/40'
                            : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={excludeTags.includes(String(tag.id))}
                          onChange={() => handleExcludeTagChange(String(tag.id))}
                          className="h-5 w-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-base text-gray-200 sm:text-sm">{tag.name}</span>
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
              <h3 className="mb-3 text-base font-semibold text-white sm:text-sm">{t.site}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 対象フィルタ */}
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.include}</p>
                  <div className="bg-gray-750 space-y-1 rounded-lg border border-gray-600 p-2 sm:space-y-0.5 sm:rounded">
                    {availableAsps.map((asp) => {
                      const providerId = ASP_TO_PROVIDER_ID[asp.id];
                      const meta = providerId ? providerMeta[providerId] : null;
                      const count = aspProductCounts[asp.id];
                      const isSelected = includeAsps.includes(asp.id);
                      return (
                        <label
                          key={`include-asp-${asp.id}`}
                          className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors sm:min-h-0 sm:rounded sm:p-1.5 ${
                            isSelected
                              ? 'bg-fuchsia-600/30 ring-2 ring-fuchsia-500'
                              : 'hover:bg-gray-700 active:bg-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleIncludeAspChange(asp.id)}
                            className="h-5 w-5 rounded border-gray-500 text-fuchsia-600 focus:ring-fuchsia-500"
                          />
                          <span
                            className="rounded px-3 py-1 text-base font-medium text-white sm:px-2 sm:py-0.5 sm:text-sm"
                            style={{
                              background: meta?.gradientColors
                                ? `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`
                                : 'linear-gradient(to right, #4b5563, #374151)',
                            }}
                          >
                            {meta?.label || asp.name}
                            {count !== undefined && (
                              <span className="ml-1.5 text-sm opacity-80 sm:ml-1 sm:text-xs">
                                ({count.toLocaleString()})
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {/* 除外フィルタ */}
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-300 sm:text-xs">{t.exclude}</p>
                  <div className="bg-gray-750 space-y-1 rounded-lg border border-gray-600 p-2 sm:space-y-0.5 sm:rounded">
                    {availableAsps.map((asp) => {
                      const providerId = ASP_TO_PROVIDER_ID[asp.id];
                      const meta = providerId ? providerMeta[providerId] : null;
                      const count = aspProductCounts[asp.id];
                      const isSelected = excludeAsps.includes(asp.id);
                      return (
                        <label
                          key={`exclude-asp-${asp.id}`}
                          className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors sm:min-h-0 sm:rounded sm:p-1.5 ${
                            isSelected ? 'bg-red-600/30 ring-2 ring-red-500' : 'hover:bg-gray-700 active:bg-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleExcludeAspChange(asp.id)}
                            className="h-5 w-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                          />
                          <span
                            className="rounded px-3 py-1 text-base font-medium text-white sm:px-2 sm:py-0.5 sm:text-sm"
                            style={{
                              background: meta?.gradientColors
                                ? `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`
                                : 'linear-gradient(to right, #4b5563, #374151)',
                            }}
                          >
                            {meta?.label || asp.name}
                            {count !== undefined && (
                              <span className="ml-1.5 text-sm opacity-80 sm:ml-1 sm:text-xs">
                                ({count.toLocaleString()})
                              </span>
                            )}
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
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 rounded-lg border border-gray-600 px-6 py-3 text-center font-medium text-gray-200 transition-colors hover:bg-gray-700 active:bg-gray-600 sm:flex-none sm:rounded-md sm:py-2"
              >
                {t.clear}
              </button>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
