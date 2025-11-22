'use client';

import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n';

interface HreflangTagsProps {
  currentLocale: Locale;
}

export default function HreflangTags({ currentLocale }: HreflangTagsProps) {
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
      {locales.map((locale) => (
        <link
          key={locale}
          rel="alternate"
          hrefLang={locale}
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
