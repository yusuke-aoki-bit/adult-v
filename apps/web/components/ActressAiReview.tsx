'use client';

import { ActressAiReview as BaseActressAiReview } from '@adult-v/shared/components';
import { ActressAiReview as ActressAiReviewType } from '@/types/product';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

interface ActressAiReviewProps {
  review: ActressAiReviewType;
  updatedAt?: string;
  actressName: string;
}

/**
 * ActressAiReview wrapper - テーマはSiteContextから自動取得
 */
export default function ActressAiReview({ review, updatedAt, actressName }: ActressAiReviewProps) {
  const theme = useSiteTheme();
  return (
    <BaseActressAiReview
      review={review}
      updatedAt={updatedAt}
      actressName={actressName}
      theme={theme}
    />
  );
}
