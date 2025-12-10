import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // サポートするロケール
  locales: ['ja', 'en', 'zh', 'zh-TW', 'ko'],
  // デフォルトロケール
  defaultLocale: 'ja',
  // ルートパスをデフォルトロケールにリダイレクト
  localePrefix: 'always',
});
