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
const PER_PAGE_KEY = 'list-per-page'; // 一覧ページの表示件数

// 許可される表示件数（デフォルト96で固定、ユーザー調整不要）
const ALLOWED_PER_PAGE = [12, 24, 48, 96] as const;
const DEFAULT_PER_PAGE = 48;

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

/**
 * 表示件数をlocalStorageから取得
 */
export function getPerPage(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(PER_PAGE_KEY);
    if (!stored) {
      return null;
    }

    const value = parseInt(stored, 10);
    if (isNaN(value) || !ALLOWED_PER_PAGE.includes(value as (typeof ALLOWED_PER_PAGE)[number])) {
      return null;
    }

    return value;
  } catch (error) {
    console.error('Error reading per page setting:', error);
    return null;
  }
}

/**
 * 表示件数をlocalStorageに保存
 */
export function savePerPage(perPage: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!ALLOWED_PER_PAGE.includes(perPage as (typeof ALLOWED_PER_PAGE)[number])) {
    return;
  }

  try {
    localStorage.setItem(PER_PAGE_KEY, perPage.toString());
  } catch (error) {
    console.error('Error saving per page setting:', error);
  }
}
