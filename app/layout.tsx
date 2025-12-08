import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { JsonLD } from "@/components/JsonLD";
import { generateBaseMetadata, generateWebSiteSchema } from "@/lib/seo";
import { defaultLocale } from "@/i18n";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import PWAInstaller from "@/components/PWAInstaller";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true, // CLS対策: フォールバックフォントのサイズを調整
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true, // CLS対策: フォールバックフォントのサイズを調整
});

export const metadata: Metadata = {
  ...generateBaseMetadata(
    'ADULT VIEWER LAB - heavy user guide',
    'Multi-platform adult streaming hub with actress-based reviews, rankings, and campaign updates for heavy users.',
  ),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ADULT VIEWER LAB',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

const websiteSchema = generateWebSiteSchema();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang={defaultLocale}>
      <head>
        {/* SEO: PageSpeedがStreaming SSR遅延出力を検出できない問題の対策 */}
        <meta name="description" content="Cross-platform adult streaming database covering DUGA, MGS, DTI, Caribbeancom with 38,000+ actresses. Browse by popularity, genres, and new releases." />
        {/* LCP改善: 画像配信ドメインへのpreconnect */}
        <link rel="preconnect" href="https://pics.dmm.co.jp" />
        <link rel="preconnect" href="https://img.duga.jp" />
        <link rel="preconnect" href="https://image.mgstage.com" />
        <link rel="preconnect" href="https://storage.googleapis.com" />
        <link rel="dns-prefetch" href="https://pics.dmm.co.jp" />
        <link rel="dns-prefetch" href="https://img.duga.jp" />
        <link rel="dns-prefetch" href="https://image.mgstage.com" />
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
        <JsonLD data={websiteSchema} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-gray-50`}
      >
        {gaId && <GoogleAnalytics gaId={gaId} />}
        <ConditionalLayout>{children}</ConditionalLayout>
        <PWAInstaller />
      </body>
    </html>
  );
}
