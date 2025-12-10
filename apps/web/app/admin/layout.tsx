import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin - Adult V',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-white font-bold text-lg">
                Adult V Admin
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/admin/stats"
                  className="text-gray-300 hover:text-white text-sm"
                >
                  Collection Stats
                </Link>
              </div>
            </div>
            <Link href="/" className="text-gray-400 hover:text-white text-sm">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
