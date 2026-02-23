import { Metadata } from 'next';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';

export const metadata: Metadata = {
  title: 'Admin - FANZA VIEWER LAB',
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href={localizedHref('/', locale)} className="text-lg font-bold text-gray-800">
                FANZA Admin
              </Link>
              <div className="flex gap-4">
                <Link
                  href={localizedHref('/admin/stats', locale)}
                  className="text-sm font-medium text-gray-600 hover:text-rose-700"
                >
                  Collection Stats
                </Link>
              </div>
            </div>
            <Link href={localizedHref('/', locale)} className="text-sm text-gray-500 hover:text-rose-700">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
