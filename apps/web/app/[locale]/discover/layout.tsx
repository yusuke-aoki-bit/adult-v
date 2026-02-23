import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: '発掘モード',
    description: 'ランダムな作品を発掘して、お気に入りを見つけよう',
  },
  en: {
    title: 'Discover Mode',
    description: 'Discover random products and find your favorites',
  },
  zh: {
    title: '发现模式',
    description: '随机发现作品，找到你的最爱',
  },
  'zh-TW': {
    title: '探索模式',
    description: '隨機探索作品，找到你的最愛',
  },
  ko: {
    title: '발견 모드',
    description: '랜덤 작품을 발견하고 즐겨찾기를 찾아보세요',
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
    robots: { index: false, follow: true }, // Dynamic content
    alternates: generateAlternates('/discover', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
