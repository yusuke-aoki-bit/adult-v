import { Metadata } from 'next';
import ImageSearchWrapper from '@/components/ImageSearchWrapper';
import { HomeSectionManager } from '@adult-v/shared/components';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? '画像で検索 | FANZA動画' : 'Image Search | FANZA Video';
  const description = locale === 'ja'
    ? '画像をアップロードして類似するアダルト動画を検索。AIが画像を分析し、最適な作品をおすすめします。'
    : 'Upload an image to find similar adult videos. AI analyzes the image and recommends the best matching products.';

  return {
    title,
    description,
    robots: { index: false, follow: false },
  };
}

export default async function ImageSearchPage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <main className="min-h-screen theme-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-2">
              {locale === 'ja' ? '画像で検索' : 'Search by Image'}
            </h1>
            <p className="theme-text-secondary">
              {locale === 'ja'
                ? '画像を貼り付け（Ctrl+V）するだけで、AIが分析して類似作品を検索します'
                : 'Just paste an image (Ctrl+V) and AI will analyze it to find similar products'}
            </p>
          </div>

          <ImageSearchWrapper locale={locale} />

          <div className="mt-8 p-4 rounded-lg bg-gray-100 border border-gray-200">
            <h2 className="font-semibold theme-text mb-2">
              {locale === 'ja' ? '使い方' : 'How to use'}
            </h2>
            <ul className="text-sm theme-text-secondary space-y-1">
              <li>
                {locale === 'ja'
                  ? '1. 検索したい画像をCtrl+Vで貼り付け（またはドラッグ＆ドロップ）'
                  : '1. Paste the image with Ctrl+V (or drag & drop)'}
              </li>
              <li>
                {locale === 'ja'
                  ? '2. 「類似作品を検索」ボタンをクリック'
                  : '2. Click "Search Similar" button'}
              </li>
              <li>
                {locale === 'ja'
                  ? '3. AIが画像を分析し、類似した作品を表示します'
                  : '3. AI analyzes the image and displays similar products'}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* セクションカスタマイズ */}
      <div className="container mx-auto px-4 pb-8">
        <HomeSectionManager locale={locale} theme="light" pageId="image-search" />
      </div>
    </main>
  );
}
