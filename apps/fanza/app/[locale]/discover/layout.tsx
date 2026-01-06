import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? '発見モード' : 'Discover Mode';
  const description = locale === 'ja'
    ? 'ランダムな作品を発見して、お気に入りを見つけよう'
    : 'Discover random products and find your favorites';

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true }, // Dynamic content
    alternates: generateAlternates('/discover', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
