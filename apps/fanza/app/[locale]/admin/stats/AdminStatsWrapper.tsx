'use client';

import { Suspense, lazy } from 'react';

const AdminStatsContent = lazy(() => import('./AdminStatsContent'));

export default function AdminStatsWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      }
    >
      <AdminStatsContent />
    </Suspense>
  );
}
