import { notFound } from 'next/navigation';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import FilterSortBar from '@/components/FilterSortBar';
import { JsonLD } from '@/components/JsonLD';
import { providerMeta } from '@/lib/providers';
import { getActressById, getProducts } from '@/lib/db/queries';
import {
  generateBaseMetadata,
  generatePersonSchema,
  generateBreadcrumbSchema,
  generateItemListSchema,
} from '@/lib/seo';
import { Metadata } from 'next';

// 動的生成（DBから毎回取得）
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    provider?: string;
    priceRange?: string;
  }>;
}

const PER_PAGE = 12;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const actress = await getActressById(id);

    if (!actress) {
      return {};
    }

    return generateBaseMetadata(
      `${actress.name} - 女優詳細`,
      `${actress.name}のプロフィールと出演作品一覧。${actress.description} 出演作品${actress.metrics.releaseCount}本を掲載中。`,
      actress.heroImage || actress.thumbnail,
      `/actress/${actress.id}`,
    );
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {};
  }
}

export default async function ActressDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  
  // IDが正しくデコードされているか確認
  const rawId = id;
  const decodedId = decodeURIComponent(rawId);
  
  // まずデコードしたIDで検索
  let actress = await getActressById(decodedId);
  
  // 見つからない場合は、元のIDで検索
  if (!actress) {
    actress = await getActressById(rawId);
  }

  if (!actress) {
    console.error(`Actress not found. Raw ID: ${rawId}, Decoded ID: ${decodedId}`);
    notFound();
  }

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const sortBy = (resolvedSearchParams.sort as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'ratingDesc' | 'ratingAsc' | 'titleAsc') || 'releaseDateDesc';
  const provider = resolvedSearchParams.provider || undefined;
  const priceRange = resolvedSearchParams.priceRange || undefined;

  // データベースからフィルター・ソート適用して取得
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  if (priceRange && priceRange !== 'all') {
    if (priceRange === '3000') {
      minPrice = 3000;
    } else {
      const [min, max] = priceRange.split('-').map(Number);
      minPrice = min;
      maxPrice = max;
    }
  }

  const allWorks = await getProducts({
    actressId: actress.id,
    sortBy,
    provider,
    minPrice,
    maxPrice,
    limit: 1000,
  });
  
  const total = allWorks.length;
  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const works = allWorks.slice(start, end);

  const personSchema = generatePersonSchema(
    actress.name,
    actress.description,
    actress.heroImage || actress.thumbnail,
    `/actress/${actress.id}`,
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'ホーム', url: '/' },
    { name: '女優図鑑', url: '/actresses' },
    { name: actress.name, url: `/actress/${actress.id}` },
  ]);

  const worksSchema = generateItemListSchema(
    works.map((w) => ({ name: w.title, url: `/product/${w.id}` })),
    `${actress.name}の出演作品`,
  );

  return (
    <>
      <JsonLD data={personSchema} />
      <JsonLD data={breadcrumbSchema} />
      {works.length > 0 && <JsonLD data={worksSchema} />}
      <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-10 space-y-12">
        {/* 女優プロフィール */}
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
                  {actress.services
                    .filter((service) => providerMeta[service]) // 存在しないプロバイダーを除外
                    .map((service) => {
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
            </div>
          </div>
        </section>

        {/* 出演作品 */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-semibold text-gray-900">出演作品</h2>
            <p className="text-gray-600 mt-2">{total}件の作品</p>
          </div>
          {total > 0 ? (
            <>
              <FilterSortBar
                defaultSort="releaseDateDesc"
                showProviderFilter={true}
                showPriceFilter={true}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {works.map((work) => (
                  <ProductCard key={work.id} product={work} />
                ))}
              </div>
              {total > PER_PAGE && (
                <Pagination
                  total={total}
                  page={page}
                  perPage={PER_PAGE}
                  basePath={`/actress/${actress.id}`}
                />
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <p className="text-gray-600">まだ作品が登録されていません</p>
            </div>
          )}
        </section>
      </div>
      </div>
    </>
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

