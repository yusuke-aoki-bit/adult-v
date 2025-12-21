import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? '予算管理' : 'Budget Manager';
  const description = locale === 'ja'
    ? '月間予算を設定し、ウォッチリストの作品を賢く購入しましょう'
    : 'Set your monthly budget and track your watchlist purchases smartly';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

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
