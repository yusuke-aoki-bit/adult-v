'use client';

import { FooterBase } from '@adult-v/shared/components';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';

export default function Footer() {
  return (
    <FooterBase
      getTranslation={getFooterTranslation}
      showPartnerBanners={false}
      showActressList={false}
      showInternalLinks={true}
      columns={3}
      isFanzaSite={true}
    />
  );
}
