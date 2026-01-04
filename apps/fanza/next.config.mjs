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
];

// FANZA固有のCSP設定
const fanzaCspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://*.dmm.co.jp https://*.dmm.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://awsimgsrc.dmm.co.jp https://placehold.co https://www.googletagmanager.com https://www.google-analytics.com https://*.mgstage.com https://image.mgstage.com https://*.duga.jp https://pic.duga.jp https://img.duga.jp https://*.sokmil.com https://img.sokmil.com https://*.heyzo.com https://*.caribbeancom.com https://*.caribbeancompr.com https://*.1pondo.tv https://*.b10f.jp https://b10f.jp https://*.fc2.com https://*.japanska-xxx.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://firebaselogging-pa.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.dmm.co.jp https://*.dmm.com",
  "media-src 'self' https://*.dmm.co.jp https://*.dmm.com https://cc3001.dmm.co.jp https://litevideo.dmm.co.jp",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

const fanzaSecurityHeaders = [
  { key: 'Content-Security-Policy', value: fanzaCspDirectives },
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
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 80, 85],
    minimumCacheTTL: 14400, // 4 hours (Next.js 16 recommended)
  },
  compress: true,
  // Next.js 16 experimental features
  experimental: {
    optimizePackageImports,
  },
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@adult-v/shared'],
  async headers() {
    return [
      { source: '/:path*', headers: fanzaSecurityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/_next/image/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  async redirects() {
    return [
      { source: '/product/:id', destination: '/products/:id', permanent: true },
      { source: '/categories/:tagId', destination: '/products?include=:tagId', permanent: true },
      { source: '/uncategorized', destination: '/products?uncategorized=true', permanent: true },
      { source: '/reviews', destination: '/?hasReview=true', permanent: true },
      { source: '/actress', destination: '/', permanent: true },
      { source: '/actress/:performerId/genre/:tagId', destination: '/actress/:performerId?include=:tagId', permanent: true },
      { source: '/search', destination: '/products', permanent: true },
      { source: '/products/search', destination: '/products', permanent: true },
      // FANZA locale redirects
      { source: '/:locale(en|zh|zh-TW|ko)/categories/:tagId', destination: '/:locale/products?include=:tagId', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/categories', destination: '/:locale/products', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/uncategorized', destination: '/:locale/products?uncategorized=true', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/reviews', destination: '/:locale?hasReview=true', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/actress', destination: '/:locale', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/actress/:performerId/genre/:tagId', destination: '/:locale/actress/:performerId?include=:tagId', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/search', destination: '/:locale/products', permanent: true },
      { source: '/:locale(en|zh|zh-TW|ko)/products/search', destination: '/:locale/products', permanent: true },
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
