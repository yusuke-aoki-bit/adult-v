import ProductCard from '@/components/ProductCard';
import { getFeaturedProducts } from '@/lib/mockData';
import Link from 'next/link';

// キャッシュ: 300秒ごとに再検証（注目作品は更新頻度が高いため長めに設定）
export const revalidate = 300;

export default async function FeaturedPage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-8">
        {/* ページヘッダー */}
        <section className="bg-gray-900 text-white rounded-3xl p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">
            Deep Review
          </p>
          <h1 className="text-4xl font-bold mt-4 mb-4">注目作品レビュー</h1>
          <p className="text-white/80 max-w-3xl">
            王道からマニアック、VRラインまで、4つの配信サービスを横断して
            コンバージョンが高い作品のみピックアップ。レビュー導線としてそのまま使えるカードを揃えました。
          </p>
        </section>

        {/* 商品一覧 */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">{featuredProducts.length}件のレビュー</p>
            <Link href="/categories" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              ジャンルから探す →
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">😔</div>
              <h3 className="text-xl font-bold mb-2">レビュー対象がありません</h3>
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
