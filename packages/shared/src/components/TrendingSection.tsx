'use client';

import { TrendAnalysis } from './';
import { useRouter } from 'next/navigation';
import { localizedHref } from '../i18n';

interface TrendingSectionProps {
  locale: string;
}

export default function TrendingSection({ locale }: TrendingSectionProps) {
  const router = useRouter();

  const handleTagClick = (tag: string) => {
    router.push(localizedHref(`/products?include=${encodeURIComponent(tag)}`, locale));
  };

  const handlePerformerClick = (performer: string) => {
    router.push(localizedHref(`/?q=${encodeURIComponent(performer)}`, locale));
  };

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <TrendAnalysis locale={locale} onTagClick={handleTagClick} onPerformerClick={handlePerformerClick} />
      </div>
    </section>
  );
}
