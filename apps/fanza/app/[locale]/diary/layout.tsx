import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = locale === 'ja' ? '視聴日記' : 'Viewing Diary';
  const description = locale === 'ja'
    ? '視聴した作品の記録と日記を管理'
    : 'Track and manage your viewing history and notes';

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true }, // User-specific content
    alternates: generateAlternates('/diary', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function DiaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
