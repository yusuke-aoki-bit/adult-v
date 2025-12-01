'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { providerMeta, ProviderId } from '@/lib/providers';

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
    sampleContent: string;
    sampleVideo: string;
    sampleImage: string;
    genre: string;
    site: string;
    include: string;
    exclude: string;
    clear: string;
  };
}

// ASP名をProviderId型に変換するマッピング
const aspToProviderId: Record<string, ProviderId | undefined> = {
  'DUGA': 'duga',
  'duga': 'duga',
  'Sokmil': 'sokmil',
  'sokmil': 'sokmil',
  'DTI': 'dti',
  'dti': 'dti',
  'MGS': 'mgs',
  'mgs': 'mgs',
  'b10f': 'b10f',
  'B10F': 'b10f',
  'FC2': 'fc2',
  'fc2': 'fc2',
  'Japanska': 'japanska',
  'japanska': 'japanska',
};

export default function ActressListFilter({
  genreTags,
  availableAsps,
  aspProductCounts,
  translations: t,
}: ActressListFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 現在のフィルター状態を取得
  const hasVideo = searchParams.get('hasVideo') === 'true';
  const hasImage = searchParams.get('hasImage') === 'true';
  const includeTags = searchParams.get('include')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  const includeAsps = searchParams.get('includeAsp')?.split(',').filter(Boolean) || [];
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

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    // フィルター関連のパラメータのみ削除（qやsortは維持）
    params.delete('hasVideo');
    params.delete('hasImage');
    params.delete('include');
    params.delete('exclude');
    params.delete('includeAsp');
    params.delete('excludeAsp');
    params.delete('page');

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const hasActiveFilters = hasVideo || hasImage || includeTags.length > 0 || excludeTags.length > 0 || includeAsps.length > 0 || excludeAsps.length > 0;
  const activeFilterCount = includeTags.length + excludeTags.length + includeAsps.length + excludeAsps.length + (hasVideo ? 1 : 0) + (hasImage ? 1 : 0);

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
        {/* サンプルコンテンツフィルター */}
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

        {/* ジャンルタグ */}
        {genreTags.length > 0 && (
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

        {/* 配信サイト（ASP）フィルター */}
        {availableAsps.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">{t.site}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 対象フィルタ */}
              <div>
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.include}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750">
                  {availableAsps.map((asp) => {
                    const providerId = aspToProviderId[asp.id];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const count = aspProductCounts[asp.id];
                    const isSelected = includeAsps.includes(asp.id);
                    return (
                      <label
                        key={`include-asp-${asp.id}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-rose-600/30 ring-2 ring-rose-500' : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleIncludeAspChange(asp.id)}
                          className="w-5 h-5 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
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
                <p className="text-sm sm:text-xs text-gray-300 mb-2 font-medium">{t.exclude}</p>
                <div className="space-y-1 sm:space-y-0.5 border border-gray-600 rounded-lg sm:rounded p-2 bg-gray-750">
                  {availableAsps.map((asp) => {
                    const providerId = aspToProviderId[asp.id];
                    const meta = providerId ? providerMeta[providerId] : null;
                    const count = aspProductCounts[asp.id];
                    const isSelected = excludeAsps.includes(asp.id);
                    return (
                      <label
                        key={`exclude-asp-${asp.id}`}
                        className={`flex items-center gap-3 p-3 sm:p-1.5 rounded-lg sm:rounded cursor-pointer min-h-[52px] sm:min-h-0 transition-colors ${
                          isSelected ? 'bg-red-600/30 ring-2 ring-red-500' : 'hover:bg-gray-700 active:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleExcludeAspChange(asp.id)}
                          className="w-5 h-5 rounded border-gray-500 text-red-600 focus:ring-red-500"
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
              className="flex-1 sm:flex-none text-center px-6 py-3 sm:py-2 border border-gray-600 text-gray-200 rounded-lg sm:rounded-md font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
