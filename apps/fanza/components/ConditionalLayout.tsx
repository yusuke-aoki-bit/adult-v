'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

// Header skeleton for Suspense fallback (light theme for FANZA)
function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-pink-200 bg-white text-gray-900">
      <div className="border-b border-pink-100 bg-pink-50">
        <div className="container mx-auto px-3 py-1 sm:px-4">
          <div className="h-4" />
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-pink-600">FANZA</span>
            <span className="text-gray-800"> Reviews</span>
          </div>
        </div>
      </div>
    </header>
  );
}

// Footer skeleton for Suspense fallback (light theme for FANZA)
function FooterSkeleton() {
  return (
    <footer className="mt-auto border-t border-pink-200 bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="h-32" />
      </div>
    </footer>
  );
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAgeVerificationPage = pathname === '/age-verification' || pathname?.includes('/age-verification');

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
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
    </>
  );
}
