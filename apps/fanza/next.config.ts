import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createBaseNextConfig,
  imageConfig,
  apiHeaders,
  staticHeaders,
  imageHeaders,
  createLegacyRedirects,
} from '@adult-v/shared/config/next-config-base';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const baseConfig = createBaseNextConfig(monorepoRoot);

// FANZA固有のCSP設定（DMM/FANZAドメインへの追加許可）
const fanzaCspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://*.dmm.co.jp https://*.dmm.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://awsimgsrc.dmm.co.jp https://placehold.co https://www.googletagmanager.com https://www.google-analytics.com https://*.mgstage.com https://image.mgstage.com https://*.duga.jp https://pic.duga.jp https://img.duga.jp https://*.sokmil.com https://img.sokmil.com",
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
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

// FANZA固有のロケールリダイレクト
const fanzaLocaleRedirects = [
  // /en/* → /:locale/products等へのリダイレクト
  { source: '/:locale(en|zh|zh-TW|ko)/categories/:tagId', destination: '/:locale/products?include=:tagId', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/categories', destination: '/:locale/products', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/uncategorized', destination: '/:locale/products?uncategorized=true', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/reviews', destination: '/:locale?hasReview=true', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/actress', destination: '/:locale', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/actress/:performerId/genre/:tagId', destination: '/:locale/actress/:performerId?include=:tagId', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/search', destination: '/:locale/products', permanent: true },
  { source: '/:locale(en|zh|zh-TW|ko)/products/search', destination: '/:locale/products', permanent: true },
];

const nextConfig: NextConfig = {
  ...baseConfig,
  images: imageConfig,
  async headers() {
    return [
      { source: '/:path*', headers: fanzaSecurityHeaders },
      { source: '/api/:path*', headers: apiHeaders },
      { source: '/_next/static/:path*', headers: staticHeaders },
      { source: '/_next/image/:path*', headers: imageHeaders },
      { source: '/fonts/:path*', headers: staticHeaders },
    ];
  },
  async redirects() {
    return [
      ...createLegacyRedirects(),
      ...fanzaLocaleRedirects,
    ];
  },
};

// Wrap with Sentry if DSN is configured
const configWithIntl = withNextIntl(nextConfig);

export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      reactComponentAnnotation: { enabled: true },
      tunnelRoute: '/monitoring',
      hideSourceMaps: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : configWithIntl;
