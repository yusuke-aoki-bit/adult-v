import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: 'プロフィール設定',
    description: 'あなたの好みを設定して、パーソナライズされた作品を見つけよう',
  },
  en: {
    title: 'Profile Settings',
    description: 'Set your preferences and discover personalized content',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = metadataTexts[locale as keyof typeof metadataTexts] ?? metadataTexts.en;

  const title = t.title;
  const description = t.description;

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
