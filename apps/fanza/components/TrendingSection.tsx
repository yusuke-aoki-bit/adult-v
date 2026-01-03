'use client';

import { TrendAnalysis } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';

interface TrendingSectionProps {
  locale: string;
}

export default function TrendingSection({ locale }: TrendingSectionProps) {
  const router = useRouter();

  const handleTagClick = (tag: string) => {
    router.push(`/${locale}/products?include=${encodeURIComponent(tag)}`);
  };

  const handlePerformerClick = (performer: string) => {
    router.push(`/${locale}?q=${encodeURIComponent(performer)}`);
  };

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <TrendAnalysis
          locale={locale}
          theme="light"
          onTagClick={handleTagClick}
          onPerformerClick={handlePerformerClick}
        />
      </div>
    </section>
  );
}
