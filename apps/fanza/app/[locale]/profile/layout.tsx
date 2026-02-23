import { Metadata } from 'next';
import { generateAlternates } from '@adult-v/shared/i18n';

const metadataTexts = {
  ja: {
    title: 'プロフィール設定',
    description: 'あなたの好みを設定して、パーソナライズされた作品を見つけよう',
  },
  en: {
    title: 'Profile Settings',
    description: 'Set your preferences and discover personalized content',
  },
  zh: {
    title: '个人资料设置',
    description: '设置偏好，发现个性化内容',
  },
  'zh-TW': {
    title: '個人資料設定',
    description: '設定偏好，探索個人化內容',
  },
  ko: {
    title: '프로필 설정',
    description: '취향을 설정하고 맞춤형 콘텐츠를 찾아보세요',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = metadataTexts[locale as keyof typeof metadataTexts] ?? metadataTexts.en;

  const title = t.title;
  const description = t.description;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: generateAlternates('/profile', baseUrl),
    openGraph: {
      title,
      description,
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
