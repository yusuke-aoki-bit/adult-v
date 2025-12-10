import { Suspense } from 'react';
import { Metadata } from 'next';
import AdminStatsContent from './AdminStatsContent';

export const metadata: Metadata = {
  title: '管理ページ | Adult Viewer Lab',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default function AdminStatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    }>
      <AdminStatsContent />
    </Suspense>
  );
}
