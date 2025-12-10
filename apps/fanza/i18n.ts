import { getRequestConfig } from 'next-intl/server';

// サポートする言語
// zh = 簡体字中国語 (Simplified Chinese)
// zh-TW = 繁体字中国語 (Traditional Chinese - Taiwan/Hong Kong)
export const locales = ['ja', 'en', 'zh', 'zh-TW', 'ko'] as const;
export type Locale = (typeof locales)[number];

// デフォルト言語
export const defaultLocale: Locale = 'ja';

// 言語表示名
export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
};

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
