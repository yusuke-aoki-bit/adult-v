import { Metadata } from 'next';
import ImageSearchWrapper from '@/components/ImageSearchWrapper';
import { HomeSectionManager } from '@adult-v/shared/components';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const translations = {
  ja: {
    metaTitle: '画像で検索 | MGS動画',
    metaDescription: '画像をアップロードして類似するアダルト動画を検索。AIが画像を分析し、最適な作品をおすすめします。',
    heading: '画像で検索',
    subtitle: '画像を貼り付け（Ctrl+V）するだけで、AIが分析して類似作品を検索します',
    howToUse: '使い方',
    step1: '1. 検索したい画像をCtrl+Vで貼り付け（またはドラッグ＆ドロップ）',
    step2: '2. 「類似作品を検索」ボタンをクリック',
    step3: '3. AIが画像を分析し、類似した作品を表示します',
  },
  en: {
    metaTitle: 'Image Search | MGS Video',
    metaDescription: 'Upload an image to find similar adult videos. AI analyzes the image and recommends the best matching products.',
    heading: 'Search by Image',
    subtitle: 'Just paste an image (Ctrl+V) and AI will analyze it to find similar products',
    howToUse: 'How to use',
    step1: '1. Paste the image with Ctrl+V (or drag & drop)',
    step2: '2. Click "Search Similar" button',
    step3: '3. AI analyzes the image and displays similar products',
  },
} as const;

function getT(locale: string) {
  return translations[locale as keyof typeof translations] || translations.ja;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getT(locale);

  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function ImageSearchPage({ params }: PageProps) {
  const { locale } = await params;
  const t = getT(locale);

  return (
    <main className="min-h-screen theme-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-2">
              {t.heading}
            </h1>
            <p className="theme-text-secondary">
              {t.subtitle}
            </p>
          </div>

          <ImageSearchWrapper locale={locale} />

          <div className="mt-8 p-4 rounded-lg bg-gray-800 border border-gray-700">
            <h2 className="font-semibold theme-text mb-2">
              {t.howToUse}
            </h2>
            <ul className="text-sm theme-text-secondary space-y-1">
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* セクションカスタマイズ */}
      <div className="container mx-auto px-4 pb-8">
        <HomeSectionManager locale={locale} theme="dark" pageId="image-search" />
      </div>
    </main>
  );
}
