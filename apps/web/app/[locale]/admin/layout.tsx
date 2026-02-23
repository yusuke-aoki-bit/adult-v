import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin - Adult V',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-bold text-white">
                Adult V Admin
              </Link>
              <div className="flex gap-4">
                <Link href="/admin/stats" className="text-sm text-gray-300 hover:text-white">
                  Collection Stats
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm text-gray-400 hover:text-white">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
