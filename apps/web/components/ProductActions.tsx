'use client';

import FavoriteButton from '@/components/FavoriteButton';
import MarkAsViewedButton from '@/components/MarkAsViewedButton';

interface ProductActionsProps {
  productId: number | string;
  title: string;
  imageUrl: string | null;
  provider: string;
  performerName?: string;
  performerId?: number | string;
  tags?: string[];
  duration?: number;
  locale: string;
}

export default function ProductActions({
  productId,
  title,
  imageUrl,
  provider,
  performerName,
  performerId,
  tags,
  duration,
  locale,
}: ProductActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <MarkAsViewedButton
        productId={String(productId)}
        title={title}
        imageUrl={imageUrl}
        aspName={provider}
        performerName={performerName}
        performerId={performerId}
        tags={tags}
        duration={duration}
        size="md"
        locale={locale}
      />
      <FavoriteButton
        type="product"
        id={productId}
        title={title}
        thumbnail={imageUrl ?? undefined}
        size="lg"
      />
    </div>
  );
}
