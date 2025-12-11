import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// モノレポルート（apps/webの2階層上）
const monorepoRoot = path.resolve(__dirname, '../..');

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
        protocol: 'https',
        hostname: 'img.duga.jp',
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
      {
        protocol: 'https',
        hostname: 'ads.b10f.jp',
      },
      {
        protocol: 'https',
        hostname: 'b10f.jp',
      },
      {
        protocol: 'https',
        hostname: 'img.sokmil.com',
      },
      {
        protocol: 'https',
        hostname: '*.sokmil.com',
      },
      {
        protocol: 'https',
        hostname: '*.japanska-xxx.com',
      },
      {
        protocol: 'https',
        hostname: 'img01.japanska-xxx.com',
      },
      {
        protocol: 'https',
        hostname: 'www.japanska-xxx.com',
      },
      // FC2
      {
        protocol: 'https',
        hostname: '*.contents.fc2.com',
      },
      {
        protocol: 'https',
        hostname: '*.fc2.com',
      },
      // DTIサイト
      {
        protocol: 'https',
        hostname: 'www.nyoshin.com',
      },
      {
        protocol: 'https',
        hostname: 'www.unkotare.com',
      },
      {
        protocol: 'https',
        hostname: 'www.caribbeancom.com',
      },
      {
        protocol: 'https',
        hostname: 'www.10musume.com',
      },
      {
        protocol: 'https',
        hostname: 'www.pacopacomama.com',
      },
      {
        protocol: 'https',
        hostname: 'www.hitozuma-giri.com',
      },
      {
        protocol: 'https',
        hostname: 'www.av-e-body.com',
      },
      {
        protocol: 'https',
        hostname: 'www.av-4610.com',
      },
      {
        protocol: 'https',
        hostname: 'www.av-0230.com',
      },
      {
        protocol: 'https',
        hostname: 'www.kin8tengoku.com',
      },
      {
        protocol: 'https',
        hostname: 'www.nozox.com',
      },
      {
        protocol: 'https',
        hostname: 'www.3d-eros.net',
      },
      {
        protocol: 'https',
        hostname: 'www.pikkur.com',
      },
      {
        protocol: 'https',
        hostname: 'www.javholic.com',
      },
      {
        protocol: 'https',
        hostname: 'smovie.1pondo.tv',
      },
      // MGS画像サーバー
      {
        protocol: 'https',
        hostname: 'image.mgstage.com',
      },
      // FANZA/DMM画像サーバー
      {
        protocol: 'https',
        hostname: 'awsimgsrc.dmm.co.jp',
      },
      {
        protocol: 'https',
        hostname: '*.dmm.co.jp',
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
  // スタンドアロンモード（Firebase App Hosting用）
  output: 'standalone',
  // monorepo用: standaloneの出力パスをモノレポルートに設定
  outputFileTracingRoot: monorepoRoot,
  // TypeScript型チェックをスキップ（ビルド時）
  typescript: {
    ignoreBuildErrors: true,
  },
  // セキュリティヘッダー設定
  async headers() {
    return [
      {
        // 全ページに適用
        source: '/:path*',
        headers: [
          // クリックジャッキング対策
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // XSS対策（ブラウザのXSSフィルター有効化）
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // MIMEタイプスニッフィング対策
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referer情報の制御
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 権限ポリシー（不要な機能を無効化）
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // HTTPS強制（本番環境用）
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        // API ルートに追加のセキュリティヘッダー
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
    ];
  },
  // リダイレクト設定
  async redirects() {
    return [
      // ============================
      // レガシーURL（locale なし）から ja へのリダイレクト
      // ============================
      // /categories → /ja/products
      {
        source: '/categories',
        destination: '/ja/products',
        permanent: true,
      },
      // /categories?category=xxx → /ja/products
      {
        source: '/categories',
        has: [{ type: 'query', key: 'category' }],
        destination: '/ja/products',
        permanent: true,
      },
      // /actress/:id → /ja/actress/:id
      {
        source: '/actress/:id',
        destination: '/ja/actress/:id',
        permanent: true,
      },
      // /product/:id → /ja/products/:id（product → products に修正）
      {
        source: '/product/:id',
        destination: '/ja/products/:id',
        permanent: true,
      },
      // /products/:id (locale なし) → /ja/products/:id
      {
        source: '/products/:id',
        destination: '/ja/products/:id',
        permanent: true,
      },
      // ============================
      // locale ありのリダイレクト
      // ============================
      // カテゴリページから一覧ページへの301リダイレクト
      {
        source: '/:locale/categories/:tagId',
        destination: '/:locale/products?include=:tagId',
        permanent: true,
      },
      {
        source: '/:locale/categories',
        destination: '/:locale/products',
        permanent: true,
      },
      // 未整理作品ページから一覧ページへの301リダイレクト
      {
        source: '/:locale/uncategorized',
        destination: '/:locale/products?uncategorized=true',
        permanent: true,
      },
      // レビューページからホームへの301リダイレクト
      {
        source: '/:locale/reviews',
        destination: '/:locale?hasReview=true',
        permanent: true,
      },
      // 女優一覧ページからホームへの301リダイレクト
      {
        source: '/:locale/actress',
        destination: '/:locale',
        permanent: true,
      },
      // 女優×ジャンルページから女優詳細ページへの301リダイレクト
      {
        source: '/:locale/actress/:performerId/genre/:tagId',
        destination: '/:locale/actress/:performerId?include=:tagId',
        permanent: true,
      },
      // 検索ページから各一覧ページへの301リダイレクト
      {
        source: '/:locale/search',
        destination: '/:locale/products',
        permanent: true,
      },
      {
        source: '/:locale/products/search',
        destination: '/:locale/products',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
