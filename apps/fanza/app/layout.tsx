import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConditionalLayout } from '@/components/ConditionalLayout';
import { JsonLD } from '@/components/JsonLD';
import { generateBaseMetadata, generateWebSiteSchema } from '@/lib/seo';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const siteMode = await getServerSiteMode();
  const themeClass = siteMode === 'fanza' ? 'theme-fanza' : 'theme-adult-v';

  return (
    <html lang={defaultLocale}>
      <head>
        {/* SEO: PageSpeedがStreaming SSR遅延出力を検出できない問題の対策 - charsetの直後に配置 */}
        <meta charSet="utf-8" />
        <title>ADULT VIEWER LAB - heavy user guide</title>
        <meta
          name="description"
          content="Cross-platform adult streaming database covering DUGA, MGS, DTI, Caribbeancom with 38,000+ actresses. Browse by popularity, genres, and new releases."
        />
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
        <link rel="dns-prefetch" href="https://b10f.jp" />
        <JsonLD data={websiteSchema} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${themeClass} flex min-h-screen flex-col antialiased`}
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
