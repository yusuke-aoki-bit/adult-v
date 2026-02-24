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
  zh: {
    makerDetails: '廠商詳情',
    makerNotFound: '未找到廠商',
    makerCategory: '廠商',
    labelCategory: '品牌',
    titleSuffix: '詳情',
    productsSuffix: '作品',
    makersList: '廠商列表',
    descriptionTemplate: (name: string, count: number, ratingStr: string) =>
      `${name}的作品一览。收录${count}部视频作品。${ratingStr}可查看人气女优和类型信息。`,
    avgRating: (rating: string) => `平均评分${rating}分。`,
  },
  'zh-TW': {
    makerDetails: '廠商詳情',
    makerNotFound: '未找到廠商',
    makerCategory: '廠商',
    labelCategory: '品牌',
    titleSuffix: '詳情',
    productsSuffix: '作品',
    makersList: '廠商列表',
    descriptionTemplate: (name: string, count: number, ratingStr: string) =>
      `${name}的作品一覽。收錄${count}部影片作品。${ratingStr}可查看人氣女優和類型資訊。`,
    avgRating: (rating: string) => `平均評分${rating}分。`,
  },
  ko: {
    makerDetails: '메이커 상세',
    makerNotFound: '메이커를 찾을 수 없습니다',
    makerCategory: '메이커',
    labelCategory: '레이블',
    titleSuffix: '상세',
    productsSuffix: '작품',
    makersList: '메이커 목록',
    descriptionTemplate: (name: string, count: number, ratingStr: string) =>
      `${name}의 작품 목록. ${count}편의 동영상 작품 수록. ${ratingStr}인기 배우와 장르 정보를 확인할 수 있습니다.`,
    avgRating: (rating: string) => `평균 평점 ${rating}점.`,
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

  // hreflang/canonical設定（localePrefix: 'never'のため?hl=パラメータ方式）
  const makerPath = `/makers/${makerId}`;
  const alternates = {
    canonical: `${baseUrl}${makerPath}`,
    languages: {
      ja: `${baseUrl}${makerPath}`,
      en: `${baseUrl}${makerPath}?hl=en`,
      zh: `${baseUrl}${makerPath}?hl=zh`,
      ko: `${baseUrl}${makerPath}?hl=ko`,
      'x-default': `${baseUrl}${makerPath}`,
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

export default async function MakerDetailLayout({ children, params }: MakerLayoutProps) {
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
