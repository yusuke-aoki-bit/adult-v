'use client';

import { ActressAiReview as BaseActressAiReview } from '@adult-v/shared/components';
import { ActressAiReview as ActressAiReviewType } from '@/types/product';

interface ActressAiReviewProps {
  review: ActressAiReviewType;
  updatedAt?: string;
  actressName: string;
}

/**
 * ActressAiReview wrapper for apps/fanza (light theme)
 */
export default function ActressAiReview({ review, updatedAt, actressName }: ActressAiReviewProps) {
  return (
    <BaseActressAiReview
      review={review}
      updatedAt={updatedAt}
      actressName={actressName}
      theme="light"
    />
  );
}
