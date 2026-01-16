import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Users, TrendingUp, Star, Film, Search } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';

interface PerformerItem {
  id: number;
  name: string;
  imageUrl: string | null;
  productCount: number;
  debutYear: number | null;
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; sort?: string; q?: string }>;
}

const ITEMS_PER_PAGE = 48;

// キャッシュ付きのパフォーマー取得（5xxエラー削減）
const getCachedPerformers = unstable_cache(
  async (page: number, sort: string, query?: string) => {
    const db = getDb();
    const offset = (page - 1) * ITEMS_PER_PAGE;

    let orderBy = sql`COUNT(DISTINCT pp.product_id) DESC`;
    if (sort === 'debut') {
      orderBy = sql`pf.debut_year DESC NULLS LAST, pf.id DESC`;
    } else if (sort === 'name') {
      orderBy = sql`pf.name ASC`;
    }

    const whereClause = query
      ? sql`WHERE pf.name ILIKE ${'%' + query + '%'}`
      : sql``;

    const [performers, countResult] = await Promise.all([
      db.execute(sql`
        SELECT
          pf.id,
          pf.name,
          pf.profile_image_url as "imageUrl",
          COUNT(DISTINCT pp.product_id)::int as "productCount",
          pf.debut_year as "debutYear"
        FROM performers pf
        LEFT JOIN product_performers pp ON pf.id = pp.performer_id
        ${whereClause}
        GROUP BY pf.id, pf.name, pf.profile_image_url, pf.debut_year
        HAVING COUNT(DISTINCT pp.product_id) > 0
        ORDER BY ${orderBy}
        LIMIT ${ITEMS_PER_PAGE}
        OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT pf.id)::int as total
        FROM performers pf
        INNER JOIN product_performers pp ON pf.id = pp.performer_id
        ${whereClause}
      `),
    ]);

    return {
      performers: performers.rows as unknown as PerformerItem[],
      total: (countResult.rows[0] as { total: number }).total,
    };
  },
  ['actresses-list'],
  { revalidate: 300, tags: ['actresses'] }
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isJa = locale === 'ja';

  const title = isJa ? 'AV女優一覧' : 'Actresses';
  const description = isJa
    ? '人気AV女優の一覧ページ。出演作品数順、デビュー年順で女優を検索できます。'
    : 'Browse popular actresses. Search by product count or debut year.';

  return {
    ...generateBaseMetadata(title, description, undefined, '/actresses', undefined, locale),
    alternates: {
      canonical: 'https://www.adult-v.com/actresses',
      languages: {
        ja: 'https://www.adult-v.com/actresses',
        en: 'https://www.adult-v.com/actresses?hl=en',
        zh: 'https://www.adult-v.com/actresses?hl=zh',
        'zh-TW': 'https://www.adult-v.com/actresses?hl=zh-TW',
        ko: 'https://www.adult-v.com/actresses?hl=ko',
        'x-default': 'https://www.adult-v.com/actresses',
      },
    },
  };
}

const translations = {
  ja: {
    title: 'AV女優一覧',
    subtitle: '人気女優をチェック',
    searchPlaceholder: '女優名で検索...',
    sortPopular: '人気順',
    sortDebut: 'デビュー順',
    sortName: '名前順',
    works: '作品',
    debut: 'デビュー',
    noResults: '該当する女優が見つかりませんでした',
  },
  en: {
    title: 'Actresses',
    subtitle: 'Browse popular actresses',
    searchPlaceholder: 'Search by name...',
    sortPopular: 'Popular',
    sortDebut: 'Debut',
    sortName: 'Name',
    works: 'works',
    debut: 'Debut',
    noResults: 'No actresses found',
  },
};

export default async function ActressesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { page: pageStr, sort = 'popular', q } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1', 10));
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const tNav = await getTranslations('nav');

  const { performers, total } = await getCachedPerformers(page, sort, q);
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const breadcrumbItems = [
    { label: tNav('home'), href: localizedHref('/', locale) },
    { label: t.title, href: localizedHref('/actresses', locale) },
  ];

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.subtitle,
    numberOfItems: total,
    itemListElement: performers.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: p.name,
        url: `https://www.adult-v.com/actress/${p.id}`,
      },
    })),
  };

  return (
    <main className="theme-body min-h-screen py-6">
      <div className="container mx-auto px-4">
        <p className="text-xs text-gray-400 mb-4 text-center">
          <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
          {locale === 'ja' ? '当ページには広告・アフィリエイトリンクが含まれています' : 'This page contains advertisements and affiliate links'}
        </p>

        <JsonLD data={collectionSchema} />
        <Breadcrumb items={breadcrumbItems} />

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-pink-400" />
            <h1 className="text-2xl md:text-3xl font-bold theme-text">{t.title}</h1>
          </div>
          <p className="theme-text-muted">{t.subtitle} ({total.toLocaleString()})</p>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form className="flex-1" method="get">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-pink-500"
              />
              {sort !== 'popular' && <input type="hidden" name="sort" value={sort} />}
            </div>
          </form>

          <div className="flex gap-2">
            {(['popular', 'debut', 'name'] as const).map((s) => (
              <Link
                key={s}
                href={localizedHref(`/actresses?sort=${s}${q ? `&q=${q}` : ''}`, locale)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sort === s
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
              >
                {t[`sort${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof t]}
              </Link>
            ))}
          </div>
        </div>

        {/* Performers Grid */}
        {performers.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {performers.map((performer) => (
              <Link
                key={performer.id}
                href={localizedHref(`/actress/${performer.id}`, locale)}
                className="group"
              >
                <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-gray-800 mb-2">
                  {performer.imageUrl ? (
                    <Image
                      src={performer.imageUrl}
                      alt={performer.name}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 12vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <h2 className="text-sm font-medium theme-text truncate group-hover:text-pink-400 transition-colors">
                  {performer.name}
                </h2>
                <div className="flex items-center gap-2 text-xs theme-text-muted">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {performer.productCount}
                  </span>
                  {performer.debutYear && (
                    <span>{performer.debutYear}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="theme-text-muted">{t.noResults}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              total={total}
              page={page}
              perPage={ITEMS_PER_PAGE}
              basePath={localizedHref('/actresses', locale)}
              queryParams={{
                ...(sort !== 'popular' && { sort }),
                ...(q && { q }),
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
