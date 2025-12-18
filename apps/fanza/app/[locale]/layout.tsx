import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { locales } from '@/i18n';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { ToastProvider } from '@/components/Toast';
import { SiteProvider } from '@/lib/contexts/SiteContext';
import { getServerSiteMode } from '@/lib/server/site-mode';
import AgeVerification from '@/components/AgeVerification';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import ScrollToTop from '@/components/ScrollToTop';
import NavigationProgress from '@/components/NavigationProgress';
import { FirebaseProvider } from '@adult-v/shared/components';
import { JsonLD } from '@/components/JsonLD';
import { generateWebSiteSchema, generateOrganizationSchema } from '@/lib/seo';
import { Metadata } from 'next';

// ロケール別のデフォルトメタデータ（PageSpeed対策）
const localeDescriptions: Record<string, string> = {
  ja: 'DUGA、MGS、DTI、カリビアンコムなど主要動画配信サイトを横断したAV女優・作品データベース。38,000名以上の女優情報、出演作品、ジャンル別検索が可能。',
  en: 'Discover 38,000+ JAV actresses across DUGA, MGS, and DTI platforms. Browse by popularity, new releases, and genres.',
  zh: '跨越DUGA、MGS、DTI等主要视频平台的AV女优和作品数据库。可搜索38,000多名女优信息。',
  ko: 'DUGA, MGS, DTI 등 주요 비디오 플랫폼을 아우르는 AV 여배우 및 작품 데이터베이스. 38,000명 이상의 여배우 정보 검색 가능.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const description = localeDescriptions[locale] || localeDescriptions.ja;

  return {
    description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as typeof locales[number])) {
    notFound();
  }

  // Fetch messages for the locale
  const messages = await getMessages();

  // サーバーサイドで年齢確認クッキーを読み取り（CLS防止）
  const cookieStore = await cookies();
  const ageVerified = cookieStore.get('age-verified')?.value === 'true';

  // サイトモードを取得（FANZAサブドメイン vs メインサイト）
  const siteMode = await getServerSiteMode();

  // SEO構造化データ
  const webSiteSchema = generateWebSiteSchema(locale);
  const organizationSchema = generateOrganizationSchema(locale);

  return (
    <NextIntlClientProvider messages={messages}>
      <SiteProvider mode={siteMode}>
        <FavoritesProvider>
          <ToastProvider>
            <FirebaseProvider>
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              <JsonLD data={webSiteSchema} />
              <JsonLD data={organizationSchema} />
              <PerformanceMonitor />
              <AgeVerification locale={locale} initialVerified={ageVerified}>
                {children}
              </AgeVerification>
              <ScrollToTop />
            </FirebaseProvider>
          </ToastProvider>
        </FavoritesProvider>
      </SiteProvider>
    </NextIntlClientProvider>
  );
}
