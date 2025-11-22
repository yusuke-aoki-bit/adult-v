import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: '*.dmm.com',
      },
      {
        protocol: 'https',
        hostname: 'pics.dmm.co.jp',
      },
      {
        protocol: 'https',
        hostname: 'pic.duga.jp',
      },
      {
        protocol: 'http',
        hostname: 'duga.jp',
      },
      {
        protocol: 'https',
        hostname: 'www.heyzo.com',
      },
      {
        protocol: 'https',
        hostname: '*.caribbeancompr.com',
      },
      {
        protocol: 'https',
        hostname: 'www.caribbeancompr.com',
      },
      {
        protocol: 'https',
        hostname: '*.1pondo.tv',
      },
      {
        protocol: 'https',
        hostname: 'www.1pondo.tv',
      },
    ],
    // SVG画像を許可
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // ビルド時間を短縮するための設定
  experimental: {
    // 静的ページ生成の並列処理を最適化
    optimizePackageImports: ['drizzle-orm'],
  },
};

export default withNextIntl(nextConfig);
