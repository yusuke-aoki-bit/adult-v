'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { providerMeta, ProviderId } from '@/lib/providers';

interface Tag {
  id: number;
  name: string;
  count: number;
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

export default function ActressProductFilter({
  genreTags,
  productCountByAsp,
  translations: t,
}: ActressProductFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 現在のフィルター状態を取得
  const hasVideo = searchParams.get('hasVideo') === 'true';
  const hasImage = searchParams.get('hasImage') === 'true';
  const includeTags = searchParams.get('include')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  const includeAsps = searchParams.get('asp')?.split(',').filter(Boolean) || [];

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

  const handleAspChange = (aspName: string) => {
    updateFilter('asp', aspName, true, includeAsps);
  };

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('hasVideo');
    params.delete('hasImage');
    params.delete('include');
    params.delete('exclude');
    params.delete('asp');
    params.delete('page');

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const hasActiveFilters = hasVideo || hasImage || includeTags.length > 0 || excludeTags.length > 0 || includeAsps.length > 0;

  return (
    <details
      className="mb-8 bg-gray-800 rounded-lg border border-gray-700"
      open={hasActiveFilters}
    >
      <summary className="px-4 py-3 cursor-pointer font-semibold text-white hover:bg-gray-750 flex justify-between items-center">
        <span>{t.filterSettings}</span>
        {hasActiveFilters && (
          <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full">
            {includeTags.length + excludeTags.length + includeAsps.length + (hasVideo ? 1 : 0) + (hasImage ? 1 : 0)}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 space-y-6">
        {/* サンプル動画・画像フィルター */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">{t.sampleContent}</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={hasVideo}
                onChange={handleVideoChange}
                className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
              />
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-200">{t.sampleVideo}</span>
            </label>
            <label className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={handleImageChange}
                className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
              />
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-200">{t.sampleImage}</span>
            </label>
          </div>
        </div>

        {/* Genre Tags */}
        {genreTags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">{t.genre}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-300 mb-2">{t.include}</p>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                  {genreTags.slice(0, 20).map((tag) => (
                    <label
                      key={`include-genre-${tag.id}`}
                      className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors ${
                        includeTags.includes(String(tag.id))
                          ? 'bg-rose-600/30 hover:bg-rose-600/40'
                          : 'hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={includeTags.includes(String(tag.id))}
                        onChange={() => handleIncludeTagChange(String(tag.id))}
                        className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-300 mb-2">{t.exclude}</p>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                  {genreTags.slice(0, 20).map((tag) => (
                    <label
                      key={`exclude-genre-${tag.id}`}
                      className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors ${
                        excludeTags.includes(String(tag.id))
                          ? 'bg-red-600/30 hover:bg-red-600/40'
                          : 'hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={excludeTags.includes(String(tag.id))}
                        onChange={() => handleExcludeTagChange(String(tag.id))}
                        className="rounded border-gray-500 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配信サイト（ASP）フィルター */}
        {productCountByAsp.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">{t.site}</h3>
            <div className="flex flex-wrap gap-2 border border-gray-600 rounded p-3 bg-gray-750">
              {productCountByAsp.map((asp) => {
                const providerId = aspToProviderId[asp.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                const isSelected = includeAsps.includes(asp.aspName);
                return (
                  <label
                    key={`asp-${asp.aspName}`}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      isSelected ? 'bg-gray-600 ring-2 ring-rose-500' : 'hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleAspChange(asp.aspName)}
                      className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                    />
                    <span className={`text-sm font-medium px-2 py-0.5 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}>
                      {meta?.label || asp.aspName}
                      <span className="ml-1 text-xs opacity-80">({asp.count})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* クリアボタンのみ */}
        {hasActiveFilters && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 border border-gray-600 text-gray-200 rounded-md hover:bg-gray-700 transition-colors"
            >
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
