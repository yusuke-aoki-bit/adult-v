import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? 'メーカー・レーベル一覧' : 'Makers & Labels';
  const description = locale === 'ja'
    ? '人気のメーカー・レーベルから作品を探す'
    : 'Browse products by popular makers and labels';

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}/${locale}/makers`,
    languages: {
      'ja': `${baseUrl}/ja/makers`,
      'en': `${baseUrl}/en/makers`,
      'zh': `${baseUrl}/zh/makers`,
      'ko': `${baseUrl}/ko/makers`,
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

export default function MakersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
