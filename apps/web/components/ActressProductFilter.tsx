'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

interface Tag {
  id: number;
  name: string;
}

interface AspCount {
  aspName: string;
  count: number;
}

interface ActressProductFilterProps {
  genreTags: Tag[];
  productCountByAsp: AspCount[];
  translations: {
    filterSettings: string;
    sampleContent: string;
    sampleVideo: string;
    sampleImage: string;
    genre: string;
    include: string;
    exclude: string;
    site: string;
    clear: string;
    performerType: string;
    solo: string;
    multi: string;
  };
}

// Available ASPs for exclude filter (same list as top page)
const allAvailableAsps = ['DUGA', 'DTI', 'Sokmil', 'MGS', 'b10f', 'FC2', 'Japanska'];

export default function ActressProductFilter({
  genreTags,
  productCountByAsp,
  translations: t,
}: ActressProductFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // apps/webではFANZAを除外（FANZAはapps/fanzaのみで表示）
  const filteredProductCountByAsp = productCountByAsp.filter(asp => asp.aspName !== 'FANZA');

  // 現在のフィルター状態を取得
  const hasVideo = searchParams.get('hasVideo') === 'true';
  const hasImage = searchParams.get('hasImage') === 'true';
  const performerType = searchParams.get('performerType') as 'solo' | 'multi' | null;
  const includeTags = searchParams.get('include')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  const includeAsps = searchParams.get('asp')?.split(',').filter(Boolean) || [];
  const excludeAsps = searchParams.get('excludeAsp')?.split(',').filter(Boolean) || [];

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
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  // チェックボックス変更ハンドラー
  const handleVideoChange = () => {
    updateFilter('hasVideo', hasVideo ? null : 'true');
  };

  const handleImageChange = () => {
    updateFilter('hasImage', hasImage ? null : 'true');
  };

  const handlePerformerTypeChange = (type: 'solo' | 'multi' | null) => {
    updateFilter('performerType', performerType === type ? null : type);
  };

  const handleIncludeTagChange = (tagId: string) => {
    updateFilter('include', tagId, true, includeTags);
  };

  const handleExcludeTagChange = (tagId: string) => {
    updateFilter('exclude', tagId, true, excludeTags);
  };

  const handleAspChange = (aspName: string) => {
    updateFilter('asp', aspName, true, includeAsps);
  };

  const handleExcludeAspChange = (aspName: string) => {
    updateFilter('excludeAsp', aspName, true, excludeAsps);
  };

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('hasVideo');
    params.delete('hasImage');
    params.delete('performerType');
    params.delete('include');
    params.delete('exclude');
    params.delete('asp');
    params.delete('excludeAsp');
    params.delete('page');

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const hasActiveFilters = hasVideo || hasImage || performerType !== null || includeTags.length > 0 || excludeTags.length > 0 || includeAsps.length > 0 || excludeAsps.length > 0;
  const activeFilterCount = includeTags.length + excludeTags.length + includeAsps.length + excludeAsps.length + (hasVideo ? 1 : 0) + (hasImage ? 1 : 0) + (performerType ? 1 : 0);

  return (
    <details
      className="mb-4 sm:mb-8 bg-gray-800 rounded-lg border border-gray-700"
      open={hasActiveFilters}
    >
      <summary className="px-4 py-4 sm:py-3 cursor-pointer font-semibold text-white hover:bg-gray-750 active:bg-gray-700 flex items-center justify-between min-h-[56px] sm:min-h-0 select-none">
        <div className="flex items-center gap-3 sm:gap-2">
          <svg className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-base sm:text-sm">{t.filterSettings}</span>
        </div>
        {hasActiveFilters && (
          <span className="text-xs bg-rose-600 text-white px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-full font-medium">
            {activeFilterCount}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 space-y-5 sm:space-y-6">
        {/* サンプル動画・画像フィルター */}
        <div>
          <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.sampleContent}</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
              hasVideo ? 'bg-rose-600/30 border-rose-500/50 hover:bg-rose-600/40' : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={hasVideo}
                onChange={handleVideoChange}
                className="w-5 h-5 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
              />
              <svg className="w-6 h-6 sm:w-5 sm:h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-base sm:text-sm text-gray-200">{t.sampleVideo}</span>
            </label>
            <label className={`flex items-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
              hasImage ? 'bg-blue-600/30 border-blue-500/50 hover:bg-blue-600/40' : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={hasImage}
                onChange={handleImageChange}
                className="w-5 h-5 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
              />
              <svg className="w-6 h-6 sm:w-5 sm:h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-base sm:text-sm text-gray-200">{t.sampleImage}</span>
            </label>
          </div>
        </div>

        {/* 出演形態フィルター */}
        <div>
          <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.performerType}</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handlePerformerTypeChange('solo')}
              className={`flex items-center justify-center gap-3 p-3 sm:p-2 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors border ${
                performerType === 'solo'
                  ? 'bg-rose-600/30 border-rose-500/50 hover:opacity-80'
                  : 'border-gray-600 hover:bg-gray-700 active:bg-gray-600'
              }`}
            >
              <svg className={`w-6 h-6 sm:w-5 sm:h-5 ${performerType === 'solo' ? 'text-rose-500' : 'text-gray-400'} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* ジャンルタグ */}
        {genreTags.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.genre}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750 -webkit-overflow-scrolling-touch">
                  {genreTags.map((tag) => (
                    <label
                      key={`include-genre-${tag.id}`}
                      className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[48px] sm:min-h-0 transition-colors ${
                        includeTags.includes(String(tag.id))
                          ? 'bg-rose-600/30 hover:bg-rose-600/40'
                          : 'hover:bg-gray-700 active:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={includeTags.includes(String(tag.id))}
                        onChange={() => handleIncludeTagChange(String(tag.id))}
                        className="w-5 h-5 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-base sm:text-sm text-gray-200">{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* 除外フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 max-h-[280px] sm:max-h-72 overflow-y-auto border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750 -webkit-overflow-scrolling-touch">
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
                      <span className="text-base sm:text-sm text-gray-200">{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配信サイト（ASP）フィルター */}
        {filteredProductCountByAsp.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.site}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750">
                  {filteredProductCountByAsp.map((asp) => {
                    const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const isSelected = includeAsps.includes(asp.aspName);
                    return (
                      <label
                        key={`include-asp-${asp.aspName}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-rose-600/30 ring-2 ring-rose-500' : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleAspChange(asp.aspName)}
                          className="w-5 h-5 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                        />
                        <span className={`text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}>
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
                  {allAvailableAsps.map((aspName) => {
                    const providerId = ASP_TO_PROVIDER_ID[aspName];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const aspData = filteredProductCountByAsp.find(a => a.aspName === aspName);
                    const count = aspData?.count || 0;
                    const isSelected = excludeAsps.includes(aspName);
                    return (
                      <label
                        key={`exclude-asp-${aspName}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-red-600/30 ring-2 ring-red-500' : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleExcludeAspChange(aspName)}
                          className="w-5 h-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
                        />
                        <span className={`text-base sm:text-sm font-medium px-3 sm:px-2 py-1 sm:py-0.5 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}>
                          {meta?.label || aspName}
                          {count > 0 && <span className="ml-1.5 sm:ml-1 text-sm sm:text-xs opacity-80">({count.toLocaleString()})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* クリアボタンのみ */}
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
