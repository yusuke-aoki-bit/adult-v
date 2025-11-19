import Link from 'next/link';
import ActressCard from '@/components/ActressCard';
import { getActresses } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';

export const metadata: Metadata = generateBaseMetadata(
  '女優一覧 - アダルト配信ハブ',
  '人気女優から新進女優まで、あなた好みの女優を見つけよう。',
  undefined,
  '/',
);

// 動的生成（DBから毎回取得）
export const dynamic = 'force-dynamic';

export default async function Home() {
  const actresses = await getActresses();

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 女優一覧 */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              女優一覧
            </h1>
            <p className="text-gray-600">
              {actresses.length}名の女優を掲載中
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {actresses.map((actress) => (
              <Link key={actress.id} href={`/actress/${actress.id}`} className="block">
                <ActressCard actress={actress} compact />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
