'use client';

import { AiProductDescription } from '@adult-v/shared/components';

interface AiProductDescriptionWrapperProps {
  productId: string;
  locale: string;
}

export default function AiProductDescriptionWrapper({ productId, locale }: AiProductDescriptionWrapperProps) {
  return (
    <AiProductDescription
      productId={productId}
      locale={locale}
      theme="dark"
      apiEndpoint={`/api/products/${productId}/generate-description`}
      autoLoad={false}
    />
  );
}
