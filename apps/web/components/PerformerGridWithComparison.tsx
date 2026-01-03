'use client';

import { PerformerListWithSelection } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';
import ActressCard from './ActressCard';

interface Performer {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
  [key: string]: unknown;
}

interface PerformerGridWithComparisonProps {
  performers: Performer[];
  locale: string;
  priority?: number;
  className?: string;
}

export function PerformerGridWithComparison({
  performers,
  locale,
  priority = 6,
  className,
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
        />
      )}
    </PerformerListWithSelection>
  );
}

export default PerformerGridWithComparison;
