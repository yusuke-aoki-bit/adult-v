import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'お気に入り | Adult Viewer Lab',
  description: 'お気に入りに登録した作品・女優の一覧',
  robots: {
    index: false,
    follow: false,
  },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
