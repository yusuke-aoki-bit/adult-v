import { Metadata } from 'next';
import AdminStatsWrapper from './AdminStatsWrapper';

export const metadata: Metadata = {
  title: '管理ページ | FANZA VIEWER LAB',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default function AdminStatsPage() {
  return <AdminStatsWrapper />;
}
