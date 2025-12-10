'use client';

import { Suspense } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';

  const isAgeVerificationPage = pathname === '/age-verification' ||
                                 pathname?.includes('/age-verification');

  if (isAgeVerificationPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <FilterPersistence />
        <PerPagePersistence />
      </Suspense>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
    </>
  );
}



