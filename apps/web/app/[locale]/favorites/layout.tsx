import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? 'お気に入り' : 'Favorites';
  const description = locale === 'ja'
    ? 'お気に入りに登録した作品・女優の一覧'
    : 'Your favorite products and actresses';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: generateAlternates('/favorites', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
