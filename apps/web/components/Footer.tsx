'use client';

import { FooterBase } from '@adult-v/shared/components';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';

// パートナーバナーコンポーネント
function PartnerBanners() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 justify-items-center">
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <DugaCredit />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <SokmilCredit variant="88x31" />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <MgsCredit />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <DtiCredit />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <B10fCredit />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <Fc2Credit />
      </div>
      <div className="w-[180px] h-[50px] flex items-center justify-center">
        <JapanskaCredit />
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
      PartnerBanners={PartnerBanners}
      columns={4}
    />
  );
}
