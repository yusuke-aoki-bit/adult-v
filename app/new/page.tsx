import CampaignCard from '@/components/CampaignCard';
import { getActiveCampaigns } from '@/lib/mockData';
import Link from 'next/link';

export default function CampaignPage() {
  const campaigns = getActiveCampaigns();

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-8">
        {/* ページヘッダー */}
        <section className="bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-3xl p-10 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-white/70">
            Campaign Alert
          </p>
          <h1 className="text-4xl font-bold mt-4 mb-4">キャンペーン速報</h1>
          <p className="text-white/80 max-w-3xl">
            DMM / APEX / SOKMIL / DTI の最新割引・セット・サブスク情報を毎日スキャン。
            女優ページやレビューから即リンクできるようタグ・期限付きで整理しています。
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">{campaigns.length}件のアクティブキャンペーン</p>
            <Link href="/featured" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              レビューと連動させる →
            </Link>
          </div>

          {campaigns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-bold mb-2">現在実施中のキャンペーンはありません</h3>
              <p className="text-gray-600 mb-6">次回更新までお待ちください。</p>
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
