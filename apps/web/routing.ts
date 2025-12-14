import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // サポートするロケール
  locales: ['ja', 'en', 'zh', 'zh-TW', 'ko'],
  // デフォルトロケール
  defaultLocale: 'ja',
  // 完全移行: パスにロケールプレフィックスを使用しない
  // 言語は ?hl= パラメータで指定（Googleスタイル）
  // 例: /products/123?hl=en, /products/123?hl=zh
  localePrefix: 'never',
  // 言語検出を無効化（?hl=パラメータまたはクッキーで明示的に指定）
  localeDetection: false,
});
