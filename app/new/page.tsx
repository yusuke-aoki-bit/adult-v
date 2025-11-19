import ProductCard from '@/components/ProductCard';
import { getNewProducts } from '@/lib/mockData';
import Link from 'next/link';

// キャッシュ: 180秒ごとに再検証（新着作品は更新頻度が高い）
export const revalidate = 180;

export default async function NewPage() {
  const newProducts = await getNewProducts();

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-8">
        {/* ページヘッダー */}
        <section className="bg-gray-900 text-white rounded-3xl p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">
            New Releases
          </p>
          <h1 className="text-4xl font-bold mt-4 mb-4">新着作品</h1>
          <p className="text-white/80 max-w-3xl">
            最新リリースされた作品を一覧で確認。新着作品からあなた好みの作品を見つけよう。
          </p>
        </section>

        {/* 商品一覧 */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">{newProducts.length}件の新着作品</p>
            <Link href="/categories" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              ジャンルから探す →
            </Link>
          </div>

          {newProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {newProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">😔</div>
              <h3 className="text-xl font-bold mb-2">新着作品がありません</h3>
              <p className="text-gray-600 mb-6">データを更新して最新作を追加してください。</p>
              <Link
                href="/"
                className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                ホームに戻る
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
