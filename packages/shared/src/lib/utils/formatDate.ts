/**
 * 日付フォーマットユーティリティ
 * Intl.RelativeTimeFormat を使用したローカライズ対応
 */

const localeMap: Record<string, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ko: 'ko-KR',
};

/**
 * 相対的な日付表示を返す（例: "3時間後", "2日後"）
 */
export function formatRelativeDate(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const resolvedLocale = localeMap[locale] || 'ja-JP';

  try {
    const rtf = new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' });

    if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    }
    return rtf.format(diffDays, 'day');
  } catch {
    // フォールバック: 簡易表示
    if (Math.abs(diffHours) < 24) {
      return `${Math.abs(diffHours)}時間${diffHours >= 0 ? '後' : '前'}`;
    }
    return `${Math.abs(diffDays)}日${diffDays >= 0 ? '後' : '前'}`;
  }
}

/**
 * 日付をローカライズしてフォーマット
 */
export function formatLocalizedDate(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const resolvedLocale = localeMap[locale] || 'ja-JP';
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  try {
    return new Intl.DateTimeFormat(resolvedLocale, options || defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}
