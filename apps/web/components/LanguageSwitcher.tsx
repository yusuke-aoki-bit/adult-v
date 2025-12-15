'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { locales, localeNames, type Locale, defaultLocale } from '@/i18n';

function LanguageSwitcherContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  // ?hl= パラメータまたはクッキーから現在の言語を取得
  useEffect(() => {
    const hlParam = searchParams.get('hl');

    if (hlParam && locales.includes(hlParam as Locale)) {
      setLocale(hlParam as Locale);
    } else {
      // クッキーから取得（フォールバック）
      const cookieLocale = document.cookie
        .split('; ')
        .find((row) => row.startsWith('NEXT_LOCALE='))
        ?.split('=')[1];
      if (cookieLocale && locales.includes(cookieLocale as Locale)) {
        setLocale(cookieLocale as Locale);
      }
    }
  }, [searchParams]);

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale === locale) return;

    // クッキーに言語設定を保存
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1年間有効

    // 新しいURLを構築（?hl= パラメータ方式）
    const newParams = new URLSearchParams(searchParams.toString());

    if (newLocale === defaultLocale) {
      // デフォルトロケールの場合は hl パラメータを削除
      newParams.delete('hl');
    } else {
      // 他の言語の場合は hl パラメータを設定
      newParams.set('hl', newLocale);
    }

    const queryString = newParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    router.push(newUrl);
  };

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => handleLanguageChange(e.target.value as Locale)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent cursor-pointer"
        aria-label="Select language"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default function LanguageSwitcher() {
  return (
    <Suspense fallback={
      <div className="relative">
        <select
          disabled
          className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm font-medium text-gray-400 cursor-wait"
        >
          <option>...</option>
        </select>
      </div>
    }>
      <LanguageSwitcherContent />
    </Suspense>
  );
}
