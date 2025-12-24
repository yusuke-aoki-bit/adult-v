import type { NextConfig } from "next";

/**
 * 共通のNext.js設定
 * apps/web と apps/fanza で共有
 */

// 大きなライブラリの最適化リスト
export const optimizePackageImports = [
  // ORM
  'drizzle-orm',
  // UI
  'lucide-react',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-select',
  '@radix-ui/react-slot',
  '@radix-ui/react-tooltip',
  // Firebase
  'firebase',
  'firebase/app',
  'firebase/auth',
  'firebase/firestore',
  // Google Cloud
  '@google-cloud/storage',
  '@google/generative-ai',
  // i18n
  'next-intl',
  // その他
  'cheerio',
  'date-fns',
  'clsx',
  'lodash',
  'zod',
];

// Remote pattern type from Next.js
type RemotePattern = {
  protocol?: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname?: string;
};

// 共通の画像リモートパターン (Next.js上限: 50パターン)
export const remotePatterns: RemotePattern[] = [
  // Placeholder
  { protocol: 'https', hostname: 'placehold.co' },
  // DMM/FANZA (ワイルドカードで統合)
  { protocol: 'https', hostname: '*.dmm.com' },
  { protocol: 'https', hostname: '*.dmm.co.jp' },
  // DUGA
  { protocol: 'https', hostname: '*.duga.jp' },
  { protocol: 'http', hostname: 'duga.jp' },
  // HEYZO
  { protocol: 'https', hostname: '*.heyzo.com' },
  // Caribbeancom (両方のドメイン)
  { protocol: 'https', hostname: '*.caribbeancompr.com' },
  { protocol: 'https', hostname: '*.caribbeancom.com' },
  // 1pondo
  { protocol: 'https', hostname: '*.1pondo.tv' },
  // MGS
  { protocol: 'https', hostname: '*.mgstage.com' },
  // B10F
  { protocol: 'https', hostname: '*.b10f.jp' },
  { protocol: 'https', hostname: 'b10f.jp' },
  // SOKMIL
  { protocol: 'https', hostname: '*.sokmil.com' },
  // Japanska
  { protocol: 'https', hostname: '*.japanska-xxx.com' },
  // FC2
  { protocol: 'https', hostname: '*.fc2.com' },
  // DTI sites (統合)
  { protocol: 'https', hostname: '*.nyoshin.com' },
  { protocol: 'https', hostname: '*.unkotare.com' },
  { protocol: 'https', hostname: '*.10musume.com' },
  { protocol: 'https', hostname: '*.pacopacomama.com' },
  { protocol: 'https', hostname: '*.hitozuma-giri.com' },
  { protocol: 'https', hostname: '*.av-e-body.com' },
  { protocol: 'https', hostname: '*.av-4610.com' },
  { protocol: 'https', hostname: '*.av-0230.com' },
  { protocol: 'https', hostname: '*.kin8tengoku.com' },
  { protocol: 'https', hostname: '*.nozox.com' },
  { protocol: 'https', hostname: '*.3d-eros.net' },
  { protocol: 'https', hostname: '*.pikkur.com' },
  { protocol: 'https', hostname: '*.javholic.com' },
  // Tokyo Hot
  { protocol: 'https', hostname: '*.tokyo-hot.com' },
  // HEYDOUGA
  { protocol: 'https', hostname: '*.heydouga.com' },
  { protocol: 'http', hostname: '*.heydouga.com' },
  { protocol: 'https', hostname: 'heydouga.com' },
  { protocol: 'http', hostname: 'heydouga.com' },
  // X1X
  { protocol: 'https', hostname: '*.x1x.com' },
  { protocol: 'http', hostname: '*.x1x.com' },
  { protocol: 'https', hostname: 'x1x.com' },
  { protocol: 'http', hostname: 'x1x.com' },
  // ENKOU55
  { protocol: 'https', hostname: '*.enkou55.com' },
  { protocol: 'http', hostname: '*.enkou55.com' },
  { protocol: 'https', hostname: 'enkou55.com' },
  { protocol: 'http', hostname: 'enkou55.com' },
  // UREKKO
  { protocol: 'https', hostname: '*.urekko.com' },
  { protocol: 'http', hostname: '*.urekko.com' },
  { protocol: 'https', hostname: 'urekko.com' },
  { protocol: 'http', hostname: 'urekko.com' },
  // TVDEAV
  { protocol: 'https', hostname: '*.tvdeav.com' },
  { protocol: 'http', hostname: '*.tvdeav.com' },
  { protocol: 'https', hostname: 'tvdeav.com' },
  { protocol: 'http', hostname: 'tvdeav.com' },
];

// 共通の画像設定
export const imageConfig: NextConfig['images'] = {
  remotePatterns,
  dangerouslyAllowSVG: true,
  contentDispositionType: 'attachment',
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

// 共通のexperimental設定
export const experimentalConfig: NextConfig['experimental'] = {
  optimizePackageImports,
};

// CSPディレクティブ（共通）
export const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://pic.duga.jp https://img.duga.jp https://ad.duga.jp https://*.mgstage.com https://image.mgstage.com https://static.mgstage.com https://img.sokmil.com https://*.sokmil.com https://sokmil-ad.com https://*.japanska-xxx.com https://wimg2.golden-gateway.com https://*.fc2.com https://*.contents.fc2.com https://ads.b10f.jp https://b10f.jp https://www.heyzo.com https://*.caribbeancompr.com https://*.1pondo.tv https://www.nyoshin.com https://www.unkotare.com https://www.caribbeancom.com https://www.10musume.com https://www.pacopacomama.com https://www.hitozuma-giri.com https://www.av-e-body.com https://www.av-4610.com https://www.av-0230.com https://www.kin8tengoku.com https://www.nozox.com https://www.3d-eros.net https://www.pikkur.com https://www.javholic.com https://smovie.1pondo.tv https://awsimgsrc.dmm.co.jp https://placehold.co https://pixelarchivenow.com https://www.googletagmanager.com https://www.google-analytics.com https://*.tokyo-hot.com https://my.cdn.tokyo-hot.com https://*.heydouga.com http://heydouga.com https://*.x1x.com http://x1x.com https://*.enkou55.com http://*.enkou55.com http://enkou55.com https://*.urekko.com http://*.urekko.com http://urekko.com https://*.tvdeav.com http://*.tvdeav.com http://tvdeav.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://firebaselogging-pa.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.dmm.co.jp https://*.dmm.com https://*.mgstage.com",
  "media-src 'self' https://*.dmm.co.jp https://*.dmm.com https://*.mgstage.com https://smovie.1pondo.tv https://sample.heyzo.com https://*.caribbeancom.com https://*.caribbeancompr.com https://*.10musume.com https://*.pacopacomama.com https://cc3001.dmm.co.jp https://litevideo.dmm.co.jp",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

// 共通のセキュリティヘッダー
export const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

// 共通のAPIヘッダー
export const apiHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

// 共通の静的アセットヘッダー
export const staticHeaders = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

// 共通の画像キャッシュヘッダー（1週間キャッシュ、1ヶ月stale-while-revalidate）
export const imageHeaders = [
  { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
];

// ページキャッシュヘッダー（1分キャッシュ、5分stale-while-revalidate）
export const pageHeaders = [
  { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
];

/**
 * 共通のヘッダー設定を生成
 */
export function createHeadersConfig() {
  return [
    { source: '/:path*', headers: securityHeaders },
    { source: '/api/:path*', headers: apiHeaders },
    { source: '/_next/static/:path*', headers: staticHeaders },
    { source: '/_next/image/:path*', headers: imageHeaders },
    { source: '/fonts/:path*', headers: staticHeaders },
    // ページキャッシュ（CDNでの短期キャッシュ）
    { source: '/:locale(ja|en|zh|ko)', headers: pageHeaders },
    { source: '/:locale(ja|en|zh|ko)/actress/:id', headers: pageHeaders },
    { source: '/:locale(ja|en|zh|ko)/products/:id', headers: pageHeaders },
  ];
}

/**
 * 共通のリダイレクト設定（i18n関連）
 */
export function createI18nRedirects() {
  return [
    // /ja/* → /* (デフォルトロケール)
    { source: '/ja', destination: '/', permanent: true },
    { source: '/ja/:path*', destination: '/:path*', permanent: true },
    // /en/* → /*?hl=en
    { source: '/en', destination: '/?hl=en', permanent: true },
    { source: '/en/:path*', destination: '/:path*?hl=en', permanent: true },
    // /zh/* → /*?hl=zh
    { source: '/zh', destination: '/?hl=zh', permanent: true },
    { source: '/zh/:path*', destination: '/:path*?hl=zh', permanent: true },
    // /zh-TW/* → /*?hl=zh-TW
    { source: '/zh-TW', destination: '/?hl=zh-TW', permanent: true },
    { source: '/zh-TW/:path*', destination: '/:path*?hl=zh-TW', permanent: true },
    // /ko/* → /*?hl=ko
    { source: '/ko', destination: '/?hl=ko', permanent: true },
    { source: '/ko/:path*', destination: '/:path*?hl=ko', permanent: true },
  ];
}

/**
 * 共通のレガシーリダイレクト設定
 */
export function createLegacyRedirects() {
  return [
    { source: '/categories', destination: '/products', permanent: true },
    { source: '/categories', has: [{ type: 'query' as const, key: 'category' }], destination: '/products', permanent: true },
    { source: '/product/:id', destination: '/products/:id', permanent: true },
    { source: '/categories/:tagId', destination: '/products?include=:tagId', permanent: true },
    { source: '/uncategorized', destination: '/products?uncategorized=true', permanent: true },
    { source: '/reviews', destination: '/?hasReview=true', permanent: true },
    { source: '/actress', destination: '/', permanent: true },
    { source: '/actress/:performerId/genre/:tagId', destination: '/actress/:performerId?include=:tagId', permanent: true },
    { source: '/search', destination: '/products', permanent: true },
    { source: '/products/search', destination: '/products', permanent: true },
  ];
}

/**
 * 基本のNext.js設定を生成
 */
export function createBaseNextConfig(monorepoRoot: string): NextConfig {
  return {
    images: imageConfig,
    compress: true,
    experimental: experimentalConfig,
    reactStrictMode: true,
    output: 'standalone',
    outputFileTracingRoot: monorepoRoot,
    typescript: {
      ignoreBuildErrors: true,
    },
    // 共有パッケージをトランスパイル対象に含めて、同じReactインスタンスを使用
    transpilePackages: ['@adult-v/shared'],
  };
}
