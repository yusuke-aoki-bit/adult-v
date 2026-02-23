import { Metadata } from 'next';

const metadataTexts = {
  ja: {
    title: 'メーカー・レーベル一覧',
    description: '人気のメーカー・レーベルから作品を探す',
  },
  en: {
    title: 'Makers & Labels',
    description: 'Browse products by popular makers and labels',
  },
  zh: {
    title: '制造商与厂牌一览',
    description: '按热门制造商和厂牌浏览作品',
  },
  'zh-TW': {
    title: '製造商與廠牌一覽',
    description: '按熱門製造商和廠牌瀏覽作品',
  },
  ko: {
    title: '제조사 및 레이블 목록',
    description: '인기 제조사 및 레이블별 작품 탐색',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = metadataTexts[locale as keyof typeof metadataTexts] ?? metadataTexts.en;

  const title = t.title;
  const description = t.description;

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}/${locale}/makers`,
    languages: {
      ja: `${baseUrl}/ja/makers`,
      en: `${baseUrl}/en/makers`,
      zh: `${baseUrl}/zh/makers`,
      ko: `${baseUrl}/ko/makers`,
      'x-default': `${baseUrl}/ja/makers`,
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

export default function MakersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
