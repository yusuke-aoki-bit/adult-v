import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? 'プロフィール設定' : 'Profile Settings';
  const description = locale === 'ja'
    ? 'あなたの好みを設定して、パーソナライズされた作品を見つけよう'
    : 'Set your preferences and discover personalized content';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: generateAlternates('/profile', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
