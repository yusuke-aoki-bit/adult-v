'use client';

import { useParams } from 'next/navigation';

const translations = {
  ja: '【PR・広告】このサイトはアフィリエイト広告を含みます。成人向けコンテンツです。表示価格は税込みで、販売サイトにより異なる場合があります。',
  en: '[AD] This site contains affiliate advertising. Adult content. Prices shown include tax and may vary by seller.',
  zh: '【广告】本网站包含联盟广告。成人内容。显示价格含税，不同销售网站可能有所不同。',
  ko: '【광고】이 사이트는 제휴 광고를 포함합니다. 성인 콘텐츠입니다. 표시 가격은 세금 포함이며, 판매 사이트에 따라 다를 수 있습니다.',
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
