'use client';

import { AiProductDescription } from './';

interface AiProductDescriptionWrapperProps {
  productId: string;
  locale: string;
}

export default function AiProductDescriptionWrapper({ productId, locale }: AiProductDescriptionWrapperProps) {
  return (
    <AiProductDescription
      productId={productId}
      locale={locale}
      apiEndpoint={`/api/products/${productId}/generate-description`}
      autoLoad={false}
    />
  );
}
