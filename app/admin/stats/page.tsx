import { Suspense } from 'react';
import AdminStatsContent from './AdminStatsContent';

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
