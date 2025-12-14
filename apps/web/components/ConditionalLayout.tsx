'use client';

import { Suspense } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

// Header skeleton for Suspense fallback
function HeaderSkeleton() {
  return (
    <header className="bg-gray-950 text-white border-b border-white/10 sticky top-0 z-50">
      <div className="bg-gray-800/80 border-b border-white/5">
        <div className="container mx-auto px-3 sm:px-4 py-1">
          <div className="h-4" />
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-rose-400">ADULT</span>
            <span className="text-white">VIEWER LAB</span>
          </div>
        </div>
      </div>
    </header>
  );
}

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
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
    </>
  );
}



