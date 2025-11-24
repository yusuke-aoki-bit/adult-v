import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

// サポートする言語
export const locales = ['ja', 'en', 'zh', 'ko'] as const;
export type Locale = (typeof locales)[number];

// デフォルト言語
export const defaultLocale: Locale = 'ja';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    return {
      locale: defaultLocale,
      messages: (await import(`./messages/${defaultLocale}.json`)).default,
    };
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
