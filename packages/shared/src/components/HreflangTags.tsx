'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { locales, defaultLocale } from '../i18n';

// ロケールからhreflang属性へのマッピング（Google推奨形式）
const hreflangMap: Record<string, string[]> = {
  ja: ['ja'],
  en: ['en'],
  zh: ['zh-Hans', 'zh-CN', 'zh-SG'], // 簡体字中国語（中国、シンガポール）
  'zh-TW': ['zh-Hant', 'zh-TW', 'zh-HK'], // 繁体字中国語（台湾、香港）
  ko: ['ko'],
};

// 追加の地域向けhreflangタグ - 現在は不要（zh-TWロケールで対応）
const additionalHreflangs: Array<{ hreflang: string; locale: string }> = [];

/**
 * URLを構築する（?hl=パラメータ方式）
 * - デフォルトロケール(ja)の場合は ?hl= なし
 * - 他のロケールの場合は ?hl={locale}
 * - 既存のクエリパラメータは保持（hl以外）
 */
function buildUrl(
  baseUrl: string,
  pathname: string,
  locale: string,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams();

  // 既存のパラメータを保持（hl, page以外）
  // hl: ロケールパラメータは新しい値で上書き
  // page: ページ番号は言語切り替え時にリセット
  searchParams.forEach((value, key) => {
    if (key !== 'hl' && key !== 'page') {
      params.set(key, value);
    }
  });

  // デフォルトロケール以外は ?hl= を追加
  if (locale !== defaultLocale) {
    params.set('hl', locale);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}${pathname}?${queryString}` : `${baseUrl}${pathname}`;
}

export default function HreflangTags() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // サイトのベースURL
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  return (
    <>
      {/* 各言語のhreflangタグ */}
      {locales.map((locale) => {
        const hreflangs = hreflangMap[locale] || [locale];
        const url = buildUrl(baseUrl, pathname, locale, searchParams);
        return hreflangs.map((hreflang) => (
          <link
            key={`${locale}-${hreflang}`}
            rel="alternate"
            hrefLang={hreflang}
            href={url}
          />
        ));
      })}
      {/* 追加の地域向けhreflangタグ */}
      {additionalHreflangs.map(({ hreflang, locale }) => (
        <link
          key={hreflang}
          rel="alternate"
          hrefLang={hreflang}
          href={buildUrl(baseUrl, pathname, locale, searchParams)}
        />
      ))}
      {/* x-defaultタグ（デフォルトはja - ?hl=なし） */}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={buildUrl(baseUrl, pathname, defaultLocale, searchParams)}
      />
    </>
  );
}
