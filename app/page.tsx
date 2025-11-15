import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ActressCard from '@/components/ActressCard';
import CampaignCard from '@/components/CampaignCard';
import {
  getFeaturedProducts,
  getNewProducts,
  getFeaturedActresses,
  getActiveCampaigns,
  actressRankings,
  genreRankings,
} from '@/lib/mockData';

export default function Home() {
  const featuredProducts = getFeaturedProducts().slice(0, 3);
  const newProducts = getNewProducts();
  const featuredActresses = getFeaturedActresses(3);
  const campaigns = getActiveCampaigns().slice(0, 3);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ヒーロー */}
      <section className="bg-gray-950 text-white py-20">
        <div className="container mx-auto px-4 flex flex-col gap-6 text-center max-w-4xl">
          <p className="text-sm uppercase tracking-[0.7em] text-white/40">
            Heavy Viewer Intelligence
          </p>
          <h1 className="text-4xl md:text-5xl font-bold">
            女優ベースで4プラットフォームを横断
          </h1>
          <p className="text-lg text-white/70">
            DMM / APEX / SOKMIL / DTI のレビュー、ランキング、キャンペーンを一箇所に収集。
            ヘビー視聴者の回遊を意識した構造でコンテンツを拡張できます。
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Link
              href="/actresses"
              className="px-8 py-3 rounded-full bg-white text-gray-900 font-semibold"
            >
              女優図鑑を見る
            </Link>
            <Link
              href="/categories"
              className="px-8 py-3 rounded-full border border-white/40 text-white font-semibold hover:bg-white/10"
            >
              ジャンル別に探す
            </Link>
          </div>
        </div>
      </section>

      {/* 女優ハイライト */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Actress Picks</p>
              <h2 className="text-3xl font-bold text-gray-900">注目女優の即戦力データ</h2>
            </div>
            <Link href="/actresses" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredActresses.map((actress) => (
              <ActressCard key={actress.id} actress={actress} />
            ))}
          </div>
        </div>
      </section>

      {/* レビュー */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Reviews</p>
              <h2 className="text-3xl font-bold text-gray-900">最新レビューで比較</h2>
            </div>
            <Link href="/featured" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              レビューページへ →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ランキング */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          <RankingCard title="女優ランキング" items={actressRankings} />
          <RankingCard title="ジャンルランキング" items={genreRankings} />
        </div>
      </section>

      {/* キャンペーン */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Campaigns</p>
              <h2 className="text-3xl font-bold text-gray-900">キャンペーン速報</h2>
            </div>
            <Link href="/new" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              一覧を見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      </section>

      {/* 新着作品 */}
      {newProducts.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">New Drops</p>
                <h2 className="text-3xl font-bold text-gray-900">直近追加の作品ログ</h2>
              </div>
              <Link href="/featured" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                レビューに追加する →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {newProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

interface RankingProps {
  title: string;
  items: { id: string; position: number; title: string; metric: string; delta?: string }[];
}

function RankingCard({ title, items }: RankingProps) {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8">
      <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{title}</p>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold text-gray-900">{item.position}</span>
              <div>
                <p className="text-lg font-semibold text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.metric}</p>
              </div>
            </div>
            {item.delta && <span className="text-sm font-semibold text-emerald-600">{item.delta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
