'use client';

import { useParams } from 'next/navigation';

const translations = {
  ja: '※このページは成人向けコンテンツを含みます。表示価格は税込みです。販売サイトにより価格が異なる場合がありますので、購入前に各サイトで最新価格をご確認ください。',
  en: '※This page contains adult content. Prices shown include tax and may vary by seller. Please verify the current price on the seller\'s site before purchasing.',
  zh: '※此页面包含成人内容。显示价格含税，不同销售网站价格可能有所不同。购买前请在各网站确认最新价格。',
  ko: '※이 페이지는 성인 콘텐츠를 포함합니다. 표시 가격은 세금 포함이며, 판매 사이트에 따라 가격이 다를 수 있습니다. 구매 전 각 사이트에서 최신 가격을 확인해 주세요.',
} as const;

export default function AdultContentNotice() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const message = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className="bg-amber-900/20 border-b border-amber-700 relative z-40">
      <div className="container mx-auto px-4 py-2">
        <p className="text-amber-200 text-xs sm:text-sm text-center font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
