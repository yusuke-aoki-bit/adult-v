import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '年齢確認 | FANZA VIEWER LAB',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AgeVerificationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
