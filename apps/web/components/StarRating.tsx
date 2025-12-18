'use client';

import { StarRating as StarRatingBase } from '@adult-v/shared/components';
import { ComponentProps } from 'react';

type StarRatingProps = Omit<ComponentProps<typeof StarRatingBase>, 'theme'>;

/**
 * StarRating for apps/web (dark theme)
 */
export default function StarRating(props: StarRatingProps) {
  return <StarRatingBase {...props} theme="dark" />;
}
