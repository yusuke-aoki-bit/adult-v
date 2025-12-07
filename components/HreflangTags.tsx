'use client';

import { usePathname } from 'next/navigation';
import { locales } from '@/i18n';

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

export default function HreflangTags() {
  const pathname = usePathname();

  // パスから現在のロケールプレフィックスを削除
  let pathWithoutLocale = pathname;
  for (const loc of locales) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      pathWithoutLocale = pathname.slice(`/${loc}`.length) || '/';
      break;
    }
  }

  // サイトのベースURL（本番環境で置き換えてください）
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return (
    <>
      {/* 各言語のhreflangタグ */}
      {locales.map((locale) => {
        const hreflangs = hreflangMap[locale] || [locale];
        return hreflangs.map((hreflang) => (
          <link
            key={`${locale}-${hreflang}`}
            rel="alternate"
            hrefLang={hreflang}
            href={`${baseUrl}/${locale}${pathWithoutLocale}`}
          />
        ));
      })}
      {/* 追加の地域向けhreflangタグ */}
      {additionalHreflangs.map(({ hreflang, locale }) => (
        <link
          key={hreflang}
          rel="alternate"
          hrefLang={hreflang}
          href={`${baseUrl}/${locale}${pathWithoutLocale}`}
        />
      ))}
      {/* x-defaultタグ（デフォルトはja） */}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${baseUrl}/ja${pathWithoutLocale}`}
      />
    </>
  );
}
