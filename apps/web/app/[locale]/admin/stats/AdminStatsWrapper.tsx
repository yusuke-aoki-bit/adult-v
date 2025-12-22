'use client';

import { Suspense, lazy } from 'react';

const AdminStatsContent = lazy(() => import('./AdminStatsContent'));

export default function AdminStatsWrapper() {
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
