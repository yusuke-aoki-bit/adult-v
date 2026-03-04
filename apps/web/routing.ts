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
  // Set-Cookieヘッダーを無効化 → Cache-Control: private を防止
  // Set-Cookieがあると Next.js が private, no-store を強制しCDNキャッシュ不可になる
  // 言語切り替えは proxy.ts の ?hl= ハンドラーで手動管理
  localeCookie: false,
});
