import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: '予算管理',
    description: '月間予算を設定し、ウォッチリストの作品を賢く購入しましょう',
  },
  en: {
    title: 'Budget Manager',
    description: 'Set your monthly budget and track your watchlist purchases smartly',
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

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true }, // User-specific content
    alternates: generateAlternates('/budget', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function BudgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
