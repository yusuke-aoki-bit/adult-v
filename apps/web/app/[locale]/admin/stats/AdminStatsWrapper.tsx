'use client';

import { Suspense, lazy } from 'react';

const AdminStatsContent = lazy(() => import('./AdminStatsContent'));

export default function AdminStatsWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-900 p-8 text-white">
          <div className="text-xl">Loading...</div>
        </div>
      }
    >
      <AdminStatsContent />
    </Suspense>
  );
}
