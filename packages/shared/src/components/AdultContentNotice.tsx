'use client';

import { useParams } from 'next/navigation';
import { adultContentNoticeTranslations } from '../lib/translations';

export default function AdultContentNotice() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const message = adultContentNoticeTranslations[locale] || adultContentNoticeTranslations['ja'];

  return (
    <div className="relative z-40 border-b border-amber-700 bg-amber-900/20">
      <div className="container mx-auto px-4 py-2">
        <p className="text-center text-xs font-medium text-amber-200 sm:text-sm">{message}</p>
      </div>
    </div>
  );
}
