/**
 * i18n 共通定義
 * Googleスタイルの ?hl= パラメータを使った言語切り替えをサポート
 */

// サポートするロケール
export const locales = ['ja', 'en', 'zh', 'zh-TW', 'ko'] as const;
export type Locale = (typeof locales)[number];

// デフォルトロケール
export const defaultLocale: Locale = 'ja';

// ロケール名のマッピング
export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
};

/**
 * ロケールが有効かどうかを確認
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * 現在の言語に基づいてリンクURLを生成
 * - デフォルトロケール(ja)の場合: パスそのまま
 * - その他の言語: ?hl={locale} を追加
 *
 * @param path - リンク先のパス（例: /products/123）
 * @param locale - 現在の言語
 * @param existingParams - 既存のクエリパラメータ
 * @returns 言語パラメータ付きのURL
 *
 * @example
 * localizedHref('/products/123', 'en') // → '/products/123?hl=en'
 * localizedHref('/products/123', 'ja') // → '/products/123'
 * localizedHref('/products?page=2', 'zh') // → '/products?page=2&hl=zh'
 */
export function localizedHref(
  path: string,
  locale: string,
  existingParams?: Record<string, string>
): string {
  // パスにすでにクエリパラメータがあるか確認
  const [basePath, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');

  // 既存のパラメータを追加
  if (existingParams) {
    Object.entries(existingParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }

  // デフォルトロケール以外は ?hl= パラメータを追加
  if (locale !== defaultLocale) {
    params.set('hl', locale);
  } else {
    // デフォルトロケールの場合は hl パラメータを削除（念のため）
    params.delete('hl');
  }

  // クエリ文字列を構築
  const newQueryString = params.toString();
  return newQueryString ? `${basePath}?${newQueryString}` : basePath;
}

/**
 * 言語切り替え用のURLを生成
 * 現在のパスを維持しつつ、指定された言語に切り替え
 *
 * @param currentPath - 現在のパス（例: /products/123?page=2）
 * @param targetLocale - 切り替え先の言語
 * @returns 新しい言語でのURL
 *
 * @example
 * switchLocaleHref('/products/123?page=2', 'en') // → '/products/123?page=2&hl=en'
 * switchLocaleHref('/products/123?hl=en', 'ja') // → '/products/123'
 */
export function switchLocaleHref(currentPath: string, targetLocale: string): string {
  const [basePath, queryString] = currentPath.split('?');
  const params = new URLSearchParams(queryString || '');

  if (targetLocale === defaultLocale) {
    // デフォルトロケールに切り替える場合は hl パラメータを削除
    params.delete('hl');
  } else {
    // 他の言語に切り替える場合は hl パラメータを設定
    params.set('hl', targetLocale);
  }

  const newQueryString = params.toString();
  return newQueryString ? `${basePath}?${newQueryString}` : basePath;
}

/**
 * URLから現在の言語を取得
 *
 * @param searchParams - URLSearchParams または クエリ文字列
 * @returns 言語コード（見つからない場合はデフォルトロケール）
 */
export function getLocaleFromUrl(searchParams: URLSearchParams | string): Locale {
  const params =
    typeof searchParams === 'string' ? new URLSearchParams(searchParams) : searchParams;
  const hl = params.get('hl');

  if (hl && isValidLocale(hl)) {
    return hl;
  }

  return defaultLocale;
}

/**
 * SEO用のhreflangリンクを生成
 *
 * @param basePath - 言語パラメータなしのベースパス
 * @param baseUrl - サイトのベースURL（例: https://www.adult-v.com）
 * @returns 各言語のhreflangオブジェクト配列
 */
export function generateHreflangLinks(
  basePath: string,
  baseUrl: string
): Array<{ hreflang: string; href: string }> {
  return [
    // x-default（デフォルトロケール）
    { hreflang: 'x-default', href: `${baseUrl}${basePath}` },
    // 日本語（デフォルト）
    { hreflang: 'ja', href: `${baseUrl}${basePath}` },
    // 英語
    { hreflang: 'en', href: `${baseUrl}${localizedHref(basePath, 'en')}` },
    // 簡体字中国語
    { hreflang: 'zh-Hans', href: `${baseUrl}${localizedHref(basePath, 'zh')}` },
    // 繁体字中国語
    { hreflang: 'zh-Hant', href: `${baseUrl}${localizedHref(basePath, 'zh-TW')}` },
    // 韓国語
    { hreflang: 'ko', href: `${baseUrl}${localizedHref(basePath, 'ko')}` },
  ];
}

/**
 * canonical URLを生成（常にデフォルトロケールのURL）
 *
 * @param basePath - 言語パラメータなしのベースパス
 * @param baseUrl - サイトのベースURL
 * @returns canonical URL
 */
export function generateCanonicalUrl(basePath: string, baseUrl: string): string {
  return `${baseUrl}${basePath}`;
}

/**
 * SEO用のalternates設定を生成（Next.js Metadata用）
 *
 * @param basePath - 言語パラメータなしのベースパス
 * @param baseUrl - サイトのベースURL
 * @returns alternates オブジェクト
 */
export function generateAlternates(basePath: string, baseUrl: string) {
  const separator = basePath.includes('?') ? '&' : '?';
  return {
    canonical: `${baseUrl}${basePath}`,
    languages: {
      'ja': `${baseUrl}${basePath}`,
      'en': `${baseUrl}${basePath}${separator}hl=en`,
      'zh': `${baseUrl}${basePath}${separator}hl=zh`,
      'zh-TW': `${baseUrl}${basePath}${separator}hl=zh-TW`,
      'ko': `${baseUrl}${basePath}${separator}hl=ko`,
      'x-default': `${baseUrl}${basePath}`,
    },
  };
}
