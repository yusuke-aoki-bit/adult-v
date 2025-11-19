import type { NextConfig } from "next";

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
    ],
  },
  // ビルド時間を短縮するための設定
  experimental: {
    // 静的ページ生成の並列処理を最適化
    optimizePackageImports: ['drizzle-orm'],
  },
};

export default nextConfig;
