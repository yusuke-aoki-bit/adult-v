import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// モノレポルート（apps/fanzaの2階層上）
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
    // CSP設定 - Google Analytics、FANZA画像・動画に対応
    const cspDirectives = [
      "default-src 'self'",
      // スクリプト: Next.js, Google Analytics, Google Tag Manager, DMM/FANZA
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://*.dmm.co.jp https://*.dmm.com",
      // スタイル: Next.js インラインスタイル
      "style-src 'self' 'unsafe-inline'",
      // 画像: FANZA/DMMホスト
      "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://awsimgsrc.dmm.co.jp https://placehold.co https://www.googletagmanager.com https://www.google-analytics.com",
      // フォント
      "font-src 'self' data:",
      // 接続先: API, Google Analytics
      "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com",
      // フレーム: FANZA動画埋め込み用
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.dmm.co.jp https://*.dmm.com",
      // メディア: FANZA動画
      "media-src 'self' https://*.dmm.co.jp https://*.dmm.com https://cc3001.dmm.co.jp https://litevideo.dmm.co.jp",
      // オブジェクト（プラグイン）は無効化
      "object-src 'none'",
      // base-uri制限
      "base-uri 'self'",
      // フォーム送信先
      "form-action 'self'",
      // フレーム祖先（クリックジャッキング対策）
      "frame-ancestors 'self'",
      // アップグレード
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        // 全ページに適用
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
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
  // 新URL構造: デフォルトロケール(ja)はパスプレフィックスなし
  // 他の言語: /en/, /zh/, /zh-TW/, /ko/ または ?hl=en 等
  async redirects() {
    return [
      // ============================
      // レガシーURL → 新URL へのリダイレクト
      // ============================
      // /categories → /products
      {
        source: '/categories',
        destination: '/products',
        permanent: true,
      },
      // /categories?category=xxx → /products
      {
        source: '/categories',
        has: [{ type: 'query', key: 'category' }],
        destination: '/products',
        permanent: true,
      },
      // /product/:id → /products/:id（product → products に修正）
      {
        source: '/product/:id',
        destination: '/products/:id',
        permanent: true,
      },
      // ============================
      // 非デフォルトロケール用リダイレクト
      // ============================
      // カテゴリページから一覧ページへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/categories/:tagId',
        destination: '/:locale/products?include=:tagId',
        permanent: true,
      },
      {
        source: '/:locale(en|zh|zh-TW|ko)/categories',
        destination: '/:locale/products',
        permanent: true,
      },
      // 未整理作品ページから一覧ページへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/uncategorized',
        destination: '/:locale/products?uncategorized=true',
        permanent: true,
      },
      // レビューページからホームへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/reviews',
        destination: '/:locale?hasReview=true',
        permanent: true,
      },
      // 女優一覧ページからホームへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/actress',
        destination: '/:locale',
        permanent: true,
      },
      // 女優×ジャンルページから女優詳細ページへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/actress/:performerId/genre/:tagId',
        destination: '/:locale/actress/:performerId?include=:tagId',
        permanent: true,
      },
      // 検索ページから各一覧ページへの301リダイレクト
      {
        source: '/:locale(en|zh|zh-TW|ko)/search',
        destination: '/:locale/products',
        permanent: true,
      },
      {
        source: '/:locale(en|zh|zh-TW|ko)/products/search',
        destination: '/:locale/products',
        permanent: true,
      },
      // ============================
      // デフォルトロケール(ja)用リダイレクト（パスプレフィックスなし）
      // ============================
      // カテゴリページから一覧ページへの301リダイレクト
      {
        source: '/categories/:tagId',
        destination: '/products?include=:tagId',
        permanent: true,
      },
      // 未整理作品ページから一覧ページへの301リダイレクト
      {
        source: '/uncategorized',
        destination: '/products?uncategorized=true',
        permanent: true,
      },
      // レビューページからホームへの301リダイレクト
      {
        source: '/reviews',
        destination: '/?hasReview=true',
        permanent: true,
      },
      // 女優一覧ページからホームへの301リダイレクト
      {
        source: '/actress',
        destination: '/',
        permanent: true,
      },
      // 女優×ジャンルページから女優詳細ページへの301リダイレクト
      {
        source: '/actress/:performerId/genre/:tagId',
        destination: '/actress/:performerId?include=:tagId',
        permanent: true,
      },
      // 検索ページから各一覧ページへの301リダイレクト
      {
        source: '/search',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/products/search',
        destination: '/products',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
