import { Metadata } from 'next';
import { getMakerById } from '@/lib/db/queries';
import { JsonLD } from '@/components/JsonLD';
import { generateBreadcrumbSchema } from '@/lib/seo';

interface MakerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; makerId: string }>;
}

const translations = {
  ja: {
    makerDetails: 'メーカー詳細',
    makerNotFound: 'メーカーが見つかりません',
    makerCategory: 'メーカー',
    labelCategory: 'レーベル',
    titleSuffix: '詳細',
    productsSuffix: '作品',
    makersList: 'メーカー一覧',
    descriptionTemplate: (name: string, count: number, ratingStr: string) =>
      `${name}の作品一覧。${count}本の動画作品を掲載。${ratingStr}人気の女優やジャンル情報も確認できます。`,
    avgRating: (rating: string) => `平均評価${rating}点。`,
  },
  en: {
    makerDetails: 'Maker Details',
    makerNotFound: 'Maker Not Found',
    makerCategory: 'Maker',
    labelCategory: 'Label',
    titleSuffix: 'Details',
    productsSuffix: 'Products',
    makersList: 'Makers',
    descriptionTemplate: (name: string, count: number, ratingStr: string) =>
      `Browse ${count} products from ${name}. ${ratingStr} View popular performers and genres.`,
    avgRating: (rating: string) => `Average rating: ${rating}.`,
  },
} as const;

function getT(locale: string) {
  return translations[locale as keyof typeof translations] || translations.ja;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; makerId: string }>;
}): Promise<Metadata> {
  const { locale, makerId } = await params;
  const t = getT(locale);

  const makerIdNum = parseInt(makerId, 10);
  if (isNaN(makerIdNum)) {
    return {
      title: t.makerDetails,
    };
  }

  const maker = await getMakerById(makerIdNum, locale);

  if (!maker) {
    return {
      title: t.makerNotFound,
    };
  }

  const categoryLabel = maker.category === 'maker' ? t.makerCategory : t.labelCategory;

  const title = `${maker.name} - ${categoryLabel} ${t.titleSuffix} | ${maker.productCount} ${t.productsSuffix}`;

  const ratingStr = maker.averageRating ? t.avgRating(maker.averageRating.toFixed(1)) : '';
  const description = t.descriptionTemplate(maker.name, maker.productCount, ratingStr);

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}/${locale}/makers/${makerId}`,
    languages: {
      'ja': `${baseUrl}/ja/makers/${makerId}`,
      'en': `${baseUrl}/en/makers/${makerId}`,
      'zh': `${baseUrl}/zh/makers/${makerId}`,
      'ko': `${baseUrl}/ko/makers/${makerId}`,
      'x-default': `${baseUrl}/ja/makers/${makerId}`,
    },
  };

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function MakerDetailLayout({
  children,
  params,
}: MakerLayoutProps) {
  const { locale, makerId } = await params;
  const t = getT(locale);
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const makerIdNum = parseInt(makerId, 10);
  const maker = !isNaN(makerIdNum) ? await getMakerById(makerIdNum, locale) : null;

  const breadcrumbItems = [
    { name: 'Home', url: `${baseUrl}/` },
    { name: t.makersList, url: `${baseUrl}/${locale}/makers` },
    ...(maker ? [{ name: maker.name, url: `${baseUrl}/${locale}/makers/${makerId}` }] : []),
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      {children}
    </>
  );
}
