'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { locales, localeNames, type Locale, defaultLocale } from '@/i18n';

function LanguageSwitcherContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Detect current locale from pathname
  let locale: Locale = defaultLocale;
  for (const loc of locales) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      locale = loc;
      break;
    }
  }

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale === locale) return;

    // クッキーに言語設定を保存
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`; // 1年間有効

    // Detect the current locale from pathname
    let currentLocale: Locale | null = null;
    let pathWithoutLocale = pathname;

    // Check if pathname starts with any locale
    for (const loc of locales) {
      if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
        currentLocale = loc;
        pathWithoutLocale = pathname.slice(`/${loc}`.length) || '/';
        break;
      }
    }

    // クエリパラメータを保持
    const queryString = searchParams.toString();
    const queryPart = queryString ? `?${queryString}` : '';

    // If we're on a non-localized page, navigate to localized version
    if (!currentLocale) {
      router.push(`/${newLocale}${pathname}${queryPart}`);
      return;
    }

    // Navigate to the new locale with the same path and query params
    router.push(`/${newLocale}${pathWithoutLocale}${queryPart}`);
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
