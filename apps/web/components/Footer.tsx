'use client';

import { useSearchParams } from 'next/navigation';
import { FooterBase } from '@adult-v/shared/components';
import { locales, defaultLocale, type Locale } from '@adult-v/shared/i18n';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';
import { DxliveCredit } from './credits/DxliveCredit';

// パートナーバナーコンポーネント
function PartnerBanners() {
  const searchParams = useSearchParams();
  const hlParam = searchParams.get('hl');
  const locale = (hlParam && locales.includes(hlParam as Locale) ? hlParam : defaultLocale) as string;

  return (
    <div className="space-y-4">
      {/* ASPパートナーバナー */}
      <div className="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <DugaCredit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <SokmilCredit variant="88x31" />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <MgsCredit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <DtiCredit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <B10fCredit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <Fc2Credit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <JapanskaCredit />
        </div>
        <div className="flex h-[50px] w-full max-w-[180px] items-center justify-center">
          <DxliveCredit />
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <FooterBase
      getTranslation={getFooterTranslation}
      showPartnerBanners={true}
      showActressList={true}
      showInternalLinks={true}
      PartnerBanners={PartnerBanners}
      columns={4}
    />
  );
}
