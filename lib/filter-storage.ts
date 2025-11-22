'use client';

/**
 * フィルター設定をlocalStorageに保存/読み込みするユーティリティ
 * トップページ（女優一覧）と女優詳細ページで別々に保存
 */

export interface FilterSettings {
  includeTags: string[];
  excludeTags: string[];
  sortBy?: string;
}

// ストレージキー
const HOME_FILTER_KEY = 'filter-settings-home'; // トップページ（女優一覧）
const ACTRESS_FILTER_KEY = 'filter-settings-actress'; // 女優詳細ページ

export function getFilterSettings(page: 'home' | 'actress'): FilterSettings | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = page === 'home' ? HOME_FILTER_KEY : ACTRESS_FILTER_KEY;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return {
      includeTags: Array.isArray(parsed.includeTags)
        ? parsed.includeTags.filter((t: unknown): t is string => typeof t === 'string')
        : [],
      excludeTags: Array.isArray(parsed.excludeTags)
        ? parsed.excludeTags.filter((t: unknown): t is string => typeof t === 'string')
        : [],
      sortBy: typeof parsed.sortBy === 'string' ? parsed.sortBy : undefined,
    };
  } catch (error) {
    console.error('Error reading filter settings:', error);
    return null;
  }
}

export function saveFilterSettings(page: 'home' | 'actress', settings: FilterSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = page === 'home' ? HOME_FILTER_KEY : ACTRESS_FILTER_KEY;

  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving filter settings:', error);
  }
}

export function clearFilterSettings(page: 'home' | 'actress'): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = page === 'home' ? HOME_FILTER_KEY : ACTRESS_FILTER_KEY;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing filter settings:', error);
  }
}
