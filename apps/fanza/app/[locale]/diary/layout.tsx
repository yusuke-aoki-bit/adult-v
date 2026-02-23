import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: '視聴日記',
    description: '視聴した作品の記録と日記を管理',
  },
  en: {
    title: 'Viewing Diary',
    description: 'Track and manage your viewing history and notes',
  },
  zh: {
    title: '观看日记',
    description: '记录和管理观看历史与笔记',
  },
  'zh-TW': {
    title: '觀看日記',
    description: '記錄和管理觀看歷史與筆記',
  },
  ko: {
    title: '시청 일기',
    description: '시청 기록과 메모를 관리합니다',
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
    robots: { index: false, follow: true }, // User-specific content
    alternates: generateAlternates('/diary', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
