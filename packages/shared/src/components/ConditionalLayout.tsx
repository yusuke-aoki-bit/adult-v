'use client';

import { Suspense, ReactNode } from 'react';
import { usePathname, useParams } from 'next/navigation';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

interface ConditionalLayoutProps {
  children: ReactNode;
  Header: React.ComponentType;
  Footer: React.ComponentType<{ locale: string }>;
}

export function ConditionalLayout({ children, Header, Footer }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';

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



