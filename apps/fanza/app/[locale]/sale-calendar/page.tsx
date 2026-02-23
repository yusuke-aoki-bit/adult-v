import { Metadata } from 'next';
import SaleCalendarContent from './SaleCalendarContent';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const translations = {
  ja: {
    title: 'セールカレンダー',
    description:
      '年間セールスケジュールと過去のセール傾向を確認できます。お得な購入タイミングを見逃さないようにしましょう。',
  },
  en: {
    title: 'Sale Calendar',
    description: 'Check the annual sale schedule and past sale trends. Never miss a good buying opportunity.',
  },
  zh: {
    title: '促销日历',
    description: '查看年度促销时间表和过去的促销趋势。不要错过好的购买时机。',
  },
  ko: {
    title: '세일 캘린더',
    description: '연간 세일 일정과 과거 세일 동향을 확인하세요. 좋은 구매 타이밍을 놓치지 마세요.',
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return {
    title: t.title,
    description: t.description,
  };
}

export default async function SaleCalendarPage({ params }: PageProps) {
  const { locale } = await params;

  return <SaleCalendarContent locale={locale} />;
}
