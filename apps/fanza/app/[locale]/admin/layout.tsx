import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin - FANZA VIEWER LAB',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-800 font-bold text-lg">
                FANZA Admin
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/admin/stats"
                  className="text-gray-600 hover:text-rose-700 text-sm font-medium"
                >
                  Collection Stats
                </Link>
              </div>
            </div>
            <Link href="/" className="text-gray-500 hover:text-rose-700 text-sm">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
