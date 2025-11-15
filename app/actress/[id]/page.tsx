import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import CampaignCard from '@/components/CampaignCard';
import {
  getActressById,
  getProductsByActress,
  getActiveCampaigns,
  providerMeta,
  getActresses,
} from '@/lib/mockData';

interface PageProps {
  params: {
    id: string;
  };
}

export default function ActressDetailPage({ params }: PageProps) {
  const actress = getActressById(params.id);

  if (!actress) {
    notFound();
  }

  const works = getProductsByActress(actress.id);
  const activeCampaigns = getActiveCampaigns().filter((campaign) =>
    actress.services.includes(campaign.provider),
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-10 space-y-12">
        <section className="bg-gray-900 text-white rounded-3xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative">
              <Image
                src={actress.heroImage}
                alt={actress.name}
                width={900}
                height={900}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent" />
              <div className="absolute bottom-6 left-6">
                <p className="text-xs uppercase tracking-widest text-white/60">{actress.catchcopy}</p>
                <h1 className="text-4xl md:text-5xl font-bold mt-2">{actress.name}</h1>
                <div className="flex flex-wrap gap-2 mt-4">
                  {actress.services.map((service) => {
                    const provider = providerMeta[service];
                    return (
                      <span
                        key={service}
                        className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${provider.accentClass}`}
                      >
                        {provider.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-8 lg:p-10 space-y-6">
              <p className="text-lg text-white/80">{actress.description}</p>
              <div className="grid grid-cols-3 gap-4">
                <Metric label="出演数" value={`${actress.metrics.releaseCount}本`} />
                <Metric label="トレンド指数" value={actress.metrics.trendingScore} />
                <Metric label="ファンスコア" value={`${actress.metrics.fanScore}%`} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-white/60 mb-2">ジャンル適性</p>
                <div className="flex flex-wrap gap-2">
                  {actress.primaryGenres.map((genre) => (
                    <span key={genre} className="px-3 py-1 rounded-full bg-white/10 text-sm">
                      #{genre}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {actress.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full border border-white/20 text-xs uppercase">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-4">
                <Link
                  href="/featured"
                  className="flex-1 text-center rounded-2xl bg-white text-gray-900 font-semibold py-3"
                >
                  最新レビューを見る
                </Link>
                <Link
                  href="/new"
                  className="flex-1 text-center rounded-2xl border border-white/40 text-white font-semibold py-3"
                >
                  対応キャンペーン
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Works</p>
              <h2 className="text-3xl font-semibold text-gray-900">出演作品レビュー</h2>
            </div>
            <Link
              href={`/categories?category=all&actress=${actress.id}`}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              全作品を確認 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {works.map((work) => (
              <ProductCard key={work.id} product={work} />
            ))}
          </div>
        </section>

        {activeCampaigns.length > 0 && (
          <section className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Campaigns</p>
              <h2 className="text-3xl font-semibold text-gray-900">対応キャンペーン</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/10 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-widest text-white/60">{label}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

export function generateStaticParams() {
  return getActresses().map((actress) => ({
    id: actress.id,
  }));
}

