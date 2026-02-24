import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConditionalLayout } from '@/components/ConditionalLayout';
import { generateBaseMetadata } from '@/lib/seo';
import { defaultLocale } from '@/i18n';
import { CookieConsent } from '@adult-v/shared/components';
import { SiteProvider } from '@/lib/contexts/SiteContext';
import { getServerSiteMode } from '@/lib/server/site-mode';
import { LazyPWAInstaller } from '@/components/LazyPWAInstaller';
import { ClientProviders } from '@adult-v/shared/components';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true, // CLS対策: フォールバックフォントのサイズを調整
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true, // CLS対策: フォールバックフォントのサイズを調整
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com'),
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env['NEXT_PUBLIC_GA_ID'];
  const siteMode = await getServerSiteMode();
  const themeClass = siteMode === 'fanza' ? 'theme-fanza' : 'theme-adult-v';

  return (
    <html lang={defaultLocale} className="overflow-x-hidden">
      <head>
        {/* charset先頭配置 — title/descriptionはMetadata APIで管理（重複防止） */}
        <meta charSet="utf-8" />
        {/* LCP改善: 画像CDNへのpreconnect（unoptimized=trueで直接CDN配信のため重要） */}
        <link rel="preconnect" href="https://pics.dmm.co.jp" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://awsimgsrc.dmm.co.jp" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://pic.duga.jp" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://image.mgstage.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://img.sokmil.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.heyzo.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.caribbeancom.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://smovie.1pondo.tv" crossOrigin="anonymous" />
        {/* DNS prefetch for less frequent image sources */}
        <link rel="dns-prefetch" href="https://www.1pondo.tv" />
        <link rel="dns-prefetch" href="https://my.cdn.tokyo-hot.com" />
        <link rel="dns-prefetch" href="https://b10f.jp" />
        {/* RSS autodiscovery */}
        <link rel="alternate" type="application/rss+xml" title="Adult Viewer Lab - 新着動画" href="/feed.xml" />
        {/* WebSite JSON-LD is rendered in [locale]/layout.tsx to avoid duplication */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${themeClass} flex min-h-screen flex-col overflow-x-hidden antialiased`}
      >
        {gaId && <CookieConsent gaId={gaId} />}
        <ClientProviders>
          <SiteProvider mode={siteMode}>
            <ConditionalLayout>{children}</ConditionalLayout>
          </SiteProvider>
        </ClientProviders>
        <LazyPWAInstaller />
      </body>
    </html>
  );
}
