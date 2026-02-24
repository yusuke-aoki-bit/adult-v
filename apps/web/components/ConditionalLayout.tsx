'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FilterPersistence from './FilterPersistence';
import PerPagePersistence from './PerPagePersistence';

// Header skeleton for Suspense fallback
function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950 text-white">
      <div className="border-b border-white/5 bg-gray-800/80">
        <div className="container mx-auto px-3 py-1 sm:px-4">
          <div className="h-4" />
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-fuchsia-400">ADULT</span>
            <span className="text-white">VIEWER LAB</span>
          </div>
        </div>
      </div>
    </header>
  );
}

// Footer skeleton for Suspense fallback
function FooterSkeleton() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-gray-950">
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
