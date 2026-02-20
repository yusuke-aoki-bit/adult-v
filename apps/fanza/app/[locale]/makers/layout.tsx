import { Metadata } from 'next';
import { localizedHref } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: 'メーカー・レーベル一覧',
    description: '人気のメーカー・レーベルから作品を探す',
  },
  en: {
    title: 'Makers & Labels',
    description: 'Browse products by popular makers and labels',
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

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}${localizedHref('/makers', locale)}`,
    languages: {
      'ja': `${baseUrl}${localizedHref('/makers', 'ja')}`,
      'en': `${baseUrl}${localizedHref('/makers', 'en')}`,
      'zh': `${baseUrl}${localizedHref('/makers', 'zh')}`,
      'ko': `${baseUrl}${localizedHref('/makers', 'ko')}`,
      'x-default': `${baseUrl}${localizedHref('/makers', 'ja')}`,
    },
  };

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
    },
  };
}

export default function MakersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
