'use client';

import { ActressCareerTimeline as ActressCareerTimelineBase } from '@adult-v/shared/components';
import { ComponentProps } from 'react';

type ActressCareerTimelineProps = Omit<ComponentProps<typeof ActressCareerTimelineBase>, 'theme'>;

/**
 * ActressCareerTimeline for apps/fanza (light theme)
 */
export default function ActressCareerTimeline(props: ActressCareerTimelineProps) {
  return <ActressCareerTimelineBase {...props} theme="light" />;
}
