/**
 * フィルター条件保存機能
 *
 * LocalStorageを使用してユーザーのフィルター設定を保存・復元
 */

export interface FilterPreset {
  id: string;
  name: string;
  createdAt: number;
  filters: FilterValues;
}

export interface FilterValues {
  // 基本フィルター
  hasVideo?: boolean;
  hasImage?: boolean;
  onSale?: boolean;
  hasReview?: boolean;
  initial?: string;
  // タグフィルター
  includeTags?: string[];
  excludeTags?: string[];
  // ASPフィルター
  includeAsps?: string[];
  excludeAsps?: string[];
  // 女優特徴フィルター
  cupSizes?: string[];
  heightMin?: number;
  heightMax?: number;
  bloodTypes?: string[];
}

const STORAGE_KEY = 'adult-v-filter-presets';
const MAX_PRESETS = 10;

/**
 * 保存されているプリセット一覧を取得
 */
export function getFilterPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const presets = JSON.parse(stored);
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

/**
 * プリセットを保存
 */
export function saveFilterPreset(name: string, filters: FilterValues): FilterPreset {
  const presets = getFilterPresets();

  const newPreset: FilterPreset = {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `プリセット ${presets.length + 1}`,
    createdAt: Date.now(),
    filters,
  };

  // 最大数を超える場合は古いものを削除
  const updatedPresets = [newPreset, ...presets].slice(0, MAX_PRESETS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPresets));
  } catch (e) {
    console.error('Failed to save filter preset:', e);
  }

  return newPreset;
}

/**
 * プリセットを削除
 */
export function deleteFilterPreset(presetId: string): void {
  const presets = getFilterPresets();
  const updated = presets.filter((p) => p.id !== presetId);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete filter preset:', e);
  }
}

/**
 * プリセット名を更新
 */
export function renameFilterPreset(presetId: string, newName: string): void {
  const presets = getFilterPresets();
  const updated = presets.map((p) => (p.id === presetId ? { ...p, name: newName.trim() } : p));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to rename filter preset:', e);
  }
}

/**
 * フィルター値をURLパラメータに変換
 */
export function filtersToSearchParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.hasVideo) params.set('hasVideo', 'true');
  if (filters.hasImage) params.set('hasImage', 'true');
  if (filters.onSale) params.set('onSale', 'true');
  if (filters.hasReview) params.set('hasReview', 'true');
  if (filters.initial) params.set('initial', filters.initial);

  if (filters.includeTags?.length) params.set('include', filters.includeTags.join(','));
  if (filters.excludeTags?.length) params.set('exclude', filters.excludeTags.join(','));
  if (filters.includeAsps?.length) params.set('includeAsp', filters.includeAsps.join(','));
  if (filters.excludeAsps?.length) params.set('excludeAsp', filters.excludeAsps.join(','));

  if (filters.cupSizes?.length) params.set('cup', filters.cupSizes.join(','));
  if (filters.heightMin !== undefined) params.set('heightMin', String(filters.heightMin));
  if (filters.heightMax !== undefined) params.set('heightMax', String(filters.heightMax));
  if (filters.bloodTypes?.length) params.set('bloodType', filters.bloodTypes.join(','));

  return params;
}

/**
 * URLパラメータからフィルター値を抽出
 */
export function searchParamsToFilters(searchParams: URLSearchParams): FilterValues {
  const filters: FilterValues = {};

  if (searchParams.get('hasVideo') === 'true') filters.hasVideo = true;
  if (searchParams.get('hasImage') === 'true') filters.hasImage = true;
  if (searchParams.get('onSale') === 'true') filters.onSale = true;
  if (searchParams.get('hasReview') === 'true') filters.hasReview = true;

  const initial = searchParams.get('initial');
  if (initial) filters.initial = initial;

  const includeTags = searchParams.get('include')?.split(',').filter(Boolean);
  if (includeTags?.length) filters.includeTags = includeTags;

  const excludeTags = searchParams.get('exclude')?.split(',').filter(Boolean);
  if (excludeTags?.length) filters.excludeTags = excludeTags;

  const includeAsps = searchParams.get('includeAsp')?.split(',').filter(Boolean);
  if (includeAsps?.length) filters.includeAsps = includeAsps;

  const excludeAsps = searchParams.get('excludeAsp')?.split(',').filter(Boolean);
  if (excludeAsps?.length) filters.excludeAsps = excludeAsps;

  const cupSizes = searchParams.get('cup')?.split(',').filter(Boolean);
  if (cupSizes?.length) filters.cupSizes = cupSizes;

  const heightMin = searchParams.get('heightMin');
  if (heightMin) filters.heightMin = parseInt(heightMin, 10);

  const heightMax = searchParams.get('heightMax');
  if (heightMax) filters.heightMax = parseInt(heightMax, 10);

  const bloodTypes = searchParams.get('bloodType')?.split(',').filter(Boolean);
  if (bloodTypes?.length) filters.bloodTypes = bloodTypes;

  return filters;
}

/**
 * フィルターが空かどうかを判定
 */
export function isEmptyFilter(filters: FilterValues): boolean {
  return (
    !filters.hasVideo &&
    !filters.hasImage &&
    !filters.onSale &&
    !filters.hasReview &&
    !filters.initial &&
    !filters.includeTags?.length &&
    !filters.excludeTags?.length &&
    !filters.includeAsps?.length &&
    !filters.excludeAsps?.length &&
    !filters.cupSizes?.length &&
    filters.heightMin === undefined &&
    filters.heightMax === undefined &&
    !filters.bloodTypes?.length
  );
}
