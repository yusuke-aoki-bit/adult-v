import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '年齢確認 | Adult Viewer Lab',
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
