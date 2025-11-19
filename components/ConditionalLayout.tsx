'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgeVerificationPage = pathname === '/age-verification';

  if (isAgeVerificationPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}



