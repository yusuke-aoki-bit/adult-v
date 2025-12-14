'use client';

import { Suspense } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

// Header skeleton for Suspense fallback (light theme for FANZA)
function HeaderSkeleton() {
  return (
    <header className="bg-white text-gray-900 border-b border-pink-200 sticky top-0 z-50">
      <div className="bg-pink-50 border-b border-pink-100">
        <div className="container mx-auto px-3 sm:px-4 py-1">
          <div className="h-4" />
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-pink-600">FANZA</span>
            <span className="text-gray-800"> Reviews</span>
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



