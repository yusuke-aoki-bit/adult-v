'use client';

import { PerformerListWithSelection } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';
import ActressCard from './ActressCard';

interface Performer {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
}

interface PerformerGridWithComparisonProps {
  performers: Performer[];
  locale: string;
  priority?: number;
  className?: string;
  /** Card size: 'full', 'compact', or 'mini' */
  size?: 'full' | 'compact' | 'mini';
}

export function PerformerGridWithComparison({
  performers,
  locale,
  priority = 6,
  className,
  size,
}: PerformerGridWithComparisonProps) {
  const theme = useSiteTheme();

  return (
    <PerformerListWithSelection
      performers={performers}
      locale={locale}
      theme={theme}
      className={className}
    >
      {(performer, index) => (
        <ActressCard
          key={performer.id}
          actress={performer as Parameters<typeof ActressCard>[0]['actress']}
          priority={index < priority}
          size={size}
        />
      )}
    </PerformerListWithSelection>
  );
}

export default PerformerGridWithComparison;
