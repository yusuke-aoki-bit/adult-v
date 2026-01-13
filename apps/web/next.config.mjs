import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const optimizePackageImports = [
  'drizzle-orm', 'lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-slot', '@radix-ui/react-tooltip',
  'firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore', '@google-cloud/storage',
  '@google/generative-ai', 'next-intl', 'cheerio', 'date-fns', 'clsx', 'lodash', 'zod', 'recharts',
];

const remotePatterns = [
  { protocol: 'https', hostname: 'placehold.co' },
  { protocol: 'https', hostname: '*.dmm.com' },
  { protocol: 'https', hostname: '*.dmm.co.jp' },
  { protocol: 'https', hostname: '*.duga.jp' },
  { protocol: 'http', hostname: 'duga.jp' },
  { protocol: 'https', hostname: '*.heyzo.com' },
  { protocol: 'https', hostname: '*.caribbeancompr.com' },
  { protocol: 'https', hostname: '*.caribbeancom.com' },
  { protocol: 'https', hostname: '*.1pondo.tv' },
  { protocol: 'https', hostname: '*.mgstage.com' },
  { protocol: 'https', hostname: '*.b10f.jp' },
  { protocol: 'https', hostname: 'b10f.jp' },
  { protocol: 'https', hostname: '*.sokmil.com' },
  { protocol: 'https', hostname: '*.japanska-xxx.com' },
  { protocol: 'https', hostname: '*.fc2.com' },
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
  { protocol: 'https', hostname: '*.tokyo-hot.com' },
  { protocol: 'https', hostname: '*.heydouga.com' },
  { protocol: 'http', hostname: '*.heydouga.com' },
  { protocol: 'https', hostname: 'heydouga.com' },
  { protocol: 'http', hostname: 'heydouga.com' },
  { protocol: 'https', hostname: '*.x1x.com' },
  { protocol: 'http', hostname: '*.x1x.com' },
  { protocol: 'https', hostname: 'x1x.com' },
  { protocol: 'http', hostname: 'x1x.com' },
];

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://pic.duga.jp https://img.duga.jp https://ad.duga.jp https://*.duga.jp https://*.mgstage.com https://image.mgstage.com https://static.mgstage.com https://img.sokmil.com https://*.sokmil.com https://sokmil-ad.com https://*.japanska-xxx.com https://wimg2.golden-gateway.com https://*.fc2.com https://*.contents.fc2.com https://ads.b10f.jp https://b10f.jp https://*.b10f.jp https://*.heyzo.com https://www.heyzo.com https://*.caribbeancompr.com https://*.caribbeancom.com https://*.1pondo.tv https://www.nyoshin.com https://*.nyoshin.com https://www.unkotare.com https://*.unkotare.com https://www.10musume.com https://*.10musume.com https://www.pacopacomama.com https://*.pacopacomama.com https://www.hitozuma-giri.com https://*.hitozuma-giri.com https://www.av-e-body.com https://*.av-e-body.com https://www.av-4610.com https://*.av-4610.com https://www.av-0230.com https://*.av-0230.com https://www.kin8tengoku.com https://*.kin8tengoku.com https://www.nozox.com https://*.nozox.com https://www.3d-eros.net https://*.3d-eros.net https://www.pikkur.com https://*.pikkur.com https://www.javholic.com https://*.javholic.com https://smovie.1pondo.tv https://awsimgsrc.dmm.co.jp https://placehold.co https://pixelarchivenow.com https://www.googletagmanager.com https://www.google-analytics.com https://*.tokyo-hot.com https://my.cdn.tokyo-hot.com https://*.heydouga.com http://heydouga.com https://*.x1x.com http://x1x.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://firebaselogging-pa.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://accounts.google.com https://*.googleapis.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.dmm.co.jp https://*.dmm.com https://*.mgstage.com https://accounts.google.com https://*.firebaseapp.com",
  "media-src 'self' https://*.dmm.co.jp https://*.dmm.com https://*.mgstage.com https://smovie.1pondo.tv https://sample.heyzo.com https://*.caribbeancom.com https://*.caribbeancompr.com https://*.10musume.com https://*.pacopacomama.com https://cc3001.dmm.co.jp https://litevideo.dmm.co.jp",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    // 小さい画像サイズを追加してサムネイル最適化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 604800, // 1週間キャッシュ
  },
  compress: true,
  // パフォーマンス最適化
  experimental: {
    optimizePackageImports,
    // Partial Prerendering（静的+動的のハイブリッド）
    ppr: 'incremental',
    // 未使用CSSの自動削除
    optimizeCss: true,
  },
  // スクリプト最適化
  compiler: {
    // 本番ビルドでconsole.logを削除
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@adult-v/shared'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/_next/image/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/:locale(ja|en|zh|ko)', headers: [{ key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' }] },
    ];
  },
  async redirects() {
    return [
      { source: '/ja', destination: '/', permanent: true },
      { source: '/ja/:path*', destination: '/:path*', permanent: true },
      { source: '/en', destination: '/?hl=en', permanent: true },
      { source: '/en/:path*', destination: '/:path*?hl=en', permanent: true },
      { source: '/zh', destination: '/?hl=zh', permanent: true },
      { source: '/zh/:path*', destination: '/:path*?hl=zh', permanent: true },
      { source: '/zh-TW', destination: '/?hl=zh-TW', permanent: true },
      { source: '/zh-TW/:path*', destination: '/:path*?hl=zh-TW', permanent: true },
      { source: '/ko', destination: '/?hl=ko', permanent: true },
      { source: '/ko/:path*', destination: '/:path*?hl=ko', permanent: true },
      { source: '/product/:id', destination: '/products/:id', permanent: true },
      { source: '/categories/:tagId', destination: '/products?include=:tagId', permanent: true },
      { source: '/uncategorized', destination: '/products?uncategorized=true', permanent: true },
      { source: '/reviews', destination: '/?hasReview=true', permanent: true },
      { source: '/actress', destination: '/', permanent: true },
      { source: '/actress/:performerId/genre/:tagId', destination: '/actress/:performerId?include=:tagId', permanent: true },
      { source: '/search', destination: '/products', permanent: true },
      { source: '/products/search', destination: '/products', permanent: true },
    ];
  },
};

// Wrap with next-intl
const configWithIntl = withNextIntl(nextConfig);

// Sentry configuration
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    reactComponentAnnotation: { enabled: true },
    automaticVercelMonitors: true,
  },
};

export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithIntl, sentryBuildOptions)
  : configWithIntl;
