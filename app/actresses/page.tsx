import ActressCard from '@/components/ActressCard';
import { categories } from '@/lib/categories';
import { getActresses } from '@/lib/mockData';
import Link from 'next/link';

export default function ActressesPage() {
  const actresses = getActresses();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 space-y-12">
        <section className="bg-gray-900 text-white rounded-3xl p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">
            Actress Intelligence Hub
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            女優軸で配信サービスを横断
          </h1>
          <p className="text-lg text-white/70 max-w-3xl">
            王道・フェチ・VR・見放題まで、各プラットフォームの主力女優をソート。レビューやキャンペーンとの連動で指名率を最大化します。
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {actresses.map((actress) => (
            <ActressCard key={actress.id} actress={actress} />
          ))}
        </section>

        <section className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold mb-4">ジャンルから逆引き</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories
              .filter((category) => category.id !== 'all')
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/categories?category=${category.id}`}
                  className="p-4 rounded-2xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all"
                >
                  <div className="text-3xl mb-2">{category.icon}</div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-gray-500">{category.description}</p>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

