import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: 'お気に入り',
    description: 'お気に入りに登録した作品・女優の一覧',
  },
  en: {
    title: 'Favorites',
    description: 'Your favorite products and actresses',
  },
  zh: {
    title: '收藏',
    description: '您收藏的作品和女优列表',
  },
  'zh-TW': {
    title: '收藏',
    description: '您收藏的作品和女優列表',
  },
  ko: {
    title: '즐겨찾기',
    description: '즐겨찾기한 작품과 배우 목록',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = metadataTexts[locale as keyof typeof metadataTexts] ?? metadataTexts.en;

  const title = t.title;
  const description = t.description;

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

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

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
