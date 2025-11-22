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
      {
        protocol: 'https',
        hostname: '*.mgstage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.mgstage.com',
      },
      {
        protocol: 'https',
        hostname: 'static.mgstage.com',
      },
    ],
    // SVG画像を許可
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 画像最適化設定
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // 圧縮を有効化
  compress: true,
  // ビルド時間を短縮するための設定
  experimental: {
    // 静的ページ生成の並列処理を最適化
    optimizePackageImports: ['drizzle-orm', 'lucide-react'],
  },
  // ReactのStrict Modeを有効化（開発時のバグ発見に役立つ）
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
