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
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
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
