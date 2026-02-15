import { Metadata } from 'next';
import { getMakerById } from '@/lib/db/queries';
import { JsonLD } from '@/components/JsonLD';
import { generateBreadcrumbSchema } from '@/lib/seo';

interface MakerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; makerId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; makerId: string }>;
}): Promise<Metadata> {
  const { locale, makerId } = await params;

  const makerIdNum = parseInt(makerId, 10);
  if (isNaN(makerIdNum)) {
    return {
      title: locale === 'ja' ? 'メーカー詳細' : 'Maker Details',
    };
  }

  const maker = await getMakerById(makerIdNum, locale);

  if (!maker) {
    return {
      title: locale === 'ja' ? 'メーカーが見つかりません' : 'Maker Not Found',
    };
  }

  const categoryLabel = locale === 'ja'
    ? (maker.category === 'maker' ? 'メーカー' : 'レーベル')
    : (maker.category === 'maker' ? 'Maker' : 'Label');

  const title = locale === 'ja'
    ? `${maker.name} - ${categoryLabel}詳細 | ${maker.productCount}作品`
    : `${maker.name} - ${categoryLabel} Details | ${maker.productCount} Products`;

  const description = locale === 'ja'
    ? `${maker.name}の作品一覧。${maker.productCount}本の動画作品を掲載。${maker.averageRating ? `平均評価${maker.averageRating.toFixed(1)}点。` : ''}人気の女優やジャンル情報も確認できます。`
    : `Browse ${maker.productCount} products from ${maker.name}. ${maker.averageRating ? `Average rating: ${maker.averageRating.toFixed(1)}.` : ''} View popular performers and genres.`;

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
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const makerIdNum = parseInt(makerId, 10);
  const maker = !isNaN(makerIdNum) ? await getMakerById(makerIdNum, locale) : null;

  const breadcrumbItems = [
    { name: 'Home', url: `${baseUrl}/` },
    { name: locale === 'ja' ? 'メーカー一覧' : 'Makers', url: `${baseUrl}/${locale}/makers` },
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
