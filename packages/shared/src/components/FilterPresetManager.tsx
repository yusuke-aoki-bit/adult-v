'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
  filtersToSearchParams,
  isEmptyFilter,
  type FilterPreset,
  type FilterValues,
} from '../lib/filter-presets';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { filterPresetManagerDefaults } from '../lib/translations';

interface FilterPresetManagerProps {
  /** 現在のフィルター値 */
  currentFilters: FilterValues;
  /** プリセット適用時のコールバック */
  onApplyPreset: (filters: FilterValues) => void;
  /** テーマ */
  theme?: 'dark' | 'light';
  /** 翻訳 */
  translations?: {
    savedFilters?: string;
    saveCurrentFilter?: string;
    presetName?: string;
    save?: string;
    cancel?: string;
    apply?: string;
    delete?: string;
    noPresets?: string;
    maxPresetsReached?: string;
  };
}

const defaultTranslations = filterPresetManagerDefaults;

export function FilterPresetManager({
  currentFilters,
  onApplyPreset,
  theme: themeProp,
  translations = defaultTranslations,
}: FilterPresetManagerProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;

  const t = { ...defaultTranslations, ...translations };
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveMode, setIsSaveMode] = useState(false);
  const [presetName, setPresetName] = useState('');

  // LocalStorageからプリセットを読み込み
  useEffect(() => {
    setPresets(getFilterPresets());
  }, []);

  const handleSave = useCallback(() => {
    if (isEmptyFilter(currentFilters)) return;

    const newPreset = saveFilterPreset(presetName, currentFilters);
    setPresets((prev) => [newPreset, ...prev].slice(0, 10));
    setPresetName('');
    setIsSaveMode(false);
  }, [currentFilters, presetName]);

  const handleDelete = useCallback((presetId: string) => {
    deleteFilterPreset(presetId);
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  }, []);

  const handleApply = useCallback(
    (preset: FilterPreset) => {
      onApplyPreset(preset.filters);
      setIsOpen(false);
    },
    [onApplyPreset],
  );

  const canSave = !isEmptyFilter(currentFilters);
  const isDark = theme === 'dark';

  return (
    <div className="relative">
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        {t.savedFilters}
        {presets.length > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              isDark ? 'bg-rose-600 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            {presets.length}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 z-50 mt-2 w-72 rounded-lg shadow-xl ${
            isDark ? 'border border-gray-700 bg-gray-800' : 'border border-gray-200 bg-white'
          }`}
        >
          <div className="p-3">
            {/* 保存モード */}
            {isSaveMode ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t.presetName}
                  className={`w-full rounded-lg px-3 py-2 text-sm ${
                    isDark
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500'
                  } border focus:border-transparent focus:ring-2 focus:ring-rose-500`}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
                  >
                    {t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveMode(false);
                      setPresetName('');
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 保存ボタン */}
                {canSave && (
                  <button
                    type="button"
                    onClick={() => setIsSaveMode(true)}
                    className={`mb-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isDark
                        ? 'border border-rose-600/30 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
                        : 'border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.saveCurrentFilter}
                  </button>
                )}

                {/* プリセット一覧 */}
                {presets.length > 0 ? (
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {presets.map((preset) => (
                      <div key={preset.id} className={`rounded-lg p-2 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`truncate text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
                          >
                            {preset.name}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {new Date(preset.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApply(preset)}
                            className="flex-1 rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                          >
                            {t.apply}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(preset.id)}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              isDark
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`py-4 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {t.noPresets}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* クリック外でドロップダウンを閉じる */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setIsSaveMode(false);
            setPresetName('');
          }}
        />
      )}
    </div>
  );
}

export default FilterPresetManager;
