import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { generateActressAltText } from '@adult-v/shared/lib/seo-utils';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Users, Film, Search } from 'lucide-react';
import Pagination from '@/components/Pagination';
import LoadMoreActresses from '@/components/LoadMoreActresses';
import ActressFilterBar from '@/components/ActressFilterBar';
import { unstable_cache } from 'next/cache';

// ISR: 1時間ごとに再検証（5xxエラー削減のためforce-dynamicから変更）
export const revalidate = 3600;

interface PerformerItem {
  id: number;
  name: string;
  imageUrl: string | null;
  productCount: number;
  debutYear: number | null;
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    q?: string;
    debutYear?: string;
    minWorks?: string;
    initial?: string;
  }>;
}

const ITEMS_PER_PAGE = 48;

interface FilterOptions {
  query?: string;
  debutYear?: string;
  minWorks?: string;
  initial?: string;
}

// デビュー年フィルターをSQLに変換
function buildDebutYearFilter(debutYear: string) {
  if (debutYear === '2024-') {
    return sql`AND pf.debut_year >= 2024`;
  } else if (debutYear === '2020-2023') {
    return sql`AND pf.debut_year >= 2020 AND pf.debut_year <= 2023`;
  } else if (debutYear === '2015-2019') {
    return sql`AND pf.debut_year >= 2015 AND pf.debut_year <= 2019`;
  } else if (debutYear === '2010-2014') {
    return sql`AND pf.debut_year >= 2010 AND pf.debut_year <= 2014`;
  } else if (debutYear === '-2009') {
    return sql`AND pf.debut_year <= 2009`;
  }
  return sql``;
}

// 頭文字フィルターをSQLに変換
function buildInitialFilter(initial: string) {
  // 五十音の行（あかさたなはまやらわ）に対応
  const hiraganaMap: Record<string, string[]> = {
    'あ': ['あ', 'い', 'う', 'え', 'お'],
    'か': ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'],
    'さ': ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
    'た': ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど'],
    'な': ['な', 'に', 'ぬ', 'ね', 'の'],
    'は': ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
    'ま': ['ま', 'み', 'む', 'め', 'も'],
    'や': ['や', 'ゆ', 'よ'],
    'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
    'わ': ['わ', 'を', 'ん'],
  };

  const chars = hiraganaMap[initial];
  if (chars) {
    // 複数文字のいずれかで始まるかをOR条件で構築（パラメータバインド）
    const likeConditions = chars.map(c => sql`pf.name_kana LIKE ${c + '%'}`);
    return sql`AND (${sql.join(likeConditions, sql` OR `)})`;
  }
  // 単一文字
  return sql`AND pf.name_kana LIKE ${initial + '%'}`;
}

// キャッシュ付きのパフォーマー取得（5xxエラー削減）
const getCachedPerformers = unstable_cache(
  async (page: number, sort: string, filters: FilterOptions) => {
    const db = getDb();
    const offset = (page - 1) * ITEMS_PER_PAGE;

    let orderBy = sql`COUNT(DISTINCT pp.product_id) DESC`;
    if (sort === 'debut') {
      orderBy = sql`pf.debut_year DESC NULLS LAST, pf.id DESC`;
    } else if (sort === 'name') {
      orderBy = sql`pf.name ASC`;
    }

    // WHERE条件を構築
    const conditions: ReturnType<typeof sql>[] = [];
    if (filters.query) {
      conditions.push(sql`pf.name ILIKE ${'%' + filters.query + '%'}`);
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // HAVING条件を構築（作品数フィルター）
    const minWorksValue = filters.minWorks ? parseInt(filters.minWorks, 10) : 1;
    const havingClause = sql`HAVING COUNT(DISTINCT pp.product_id) >= ${minWorksValue}`;

    // デビュー年フィルター
    const debutYearFilter = filters.debutYear ? buildDebutYearFilter(filters.debutYear) : sql``;

    // 頭文字フィルター
    const initialFilter = filters.initial ? buildInitialFilter(filters.initial) : sql``;

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
        ${debutYearFilter}
        ${initialFilter}
        GROUP BY pf.id, pf.name, pf.profile_image_url, pf.debut_year
        ${havingClause}
        ORDER BY ${orderBy}
        LIMIT ${ITEMS_PER_PAGE}
        OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*) as total FROM (
          SELECT pf.id
          FROM performers pf
          INNER JOIN product_performers pp ON pf.id = pp.performer_id
          ${whereClause}
          ${debutYearFilter}
          ${initialFilter}
          GROUP BY pf.id
          ${havingClause}
        ) subquery
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

const metaTranslations = {
  ja: {
    metaTitle: 'AV女優一覧',
    metaDescription: '人気AV女優の一覧ページ。出演作品数順、デビュー年順で女優を検索できます。',
  },
  en: {
    metaTitle: 'Actresses',
    metaDescription: 'Browse popular actresses. Search by product count or debut year.',
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;

  return {
    ...generateBaseMetadata(mt.metaTitle, mt.metaDescription, undefined, '/actresses', undefined, locale),
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
    loading: '読み込み中...',
    loadMore: 'さらに{count}名を表示',
    allLoaded: 'すべて表示しました（{count}名）',
    loadError: '読み込みに失敗しました',
    retry: '再試行',
    prNotice: '当ページには広告・アフィリエイトリンクが含まれています',
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
    loading: 'Loading...',
    loadMore: 'Load {count} more',
    allLoaded: 'All loaded ({count} actresses)',
    loadError: 'Failed to load',
    retry: 'Retry',
    prNotice: 'This page contains advertisements and affiliate links',
  },
};

export default async function ActressesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { page: pageStr, sort = 'popular', q, debutYear, minWorks, initial } = await searchParams;
  const page = Math.max(1, Math.min(parseInt(pageStr || '1', 10), 500));
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const tNav = await getTranslations('nav');

  const filters: FilterOptions = {
    query: q,
    debutYear,
    minWorks,
    initial,
  };

  // try-catchで5xxエラーを防止
  let performers: PerformerItem[] = [];
  let total = 0;
  try {
    const result = await getCachedPerformers(page, sort, filters);
    performers = result.performers;
    total = result.total;
  } catch (error) {
    console.error('Failed to fetch performers:', error);
    // 空の結果を返してページは表示する
  }
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
          {t.prNotice}
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
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
              {debutYear && <input type="hidden" name="debutYear" value={debutYear} />}
              {minWorks && <input type="hidden" name="minWorks" value={minWorks} />}
            </div>
          </form>

          <div className="flex gap-2">
            {(['popular', 'debut', 'name'] as const).map((s) => (
              <Link
                key={s}
                href={localizedHref(`/actresses?sort=${s}${q ? `&q=${q}` : ''}${debutYear ? `&debutYear=${debutYear}` : ''}${minWorks ? `&minWorks=${minWorks}` : ''}`, locale)}
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

        {/* Filter Bar */}
        <ActressFilterBar />

        {/* Performers Grid */}
        {performers.length > 0 ? (
          page === 1 ? (
            /* 1ページ目: 無限スクロール（エンゲージメント向上） */
            <LoadMoreActresses
              initialPerformers={performers}
              totalCount={total}
              perPage={ITEMS_PER_PAGE}
              locale={locale}
              sort={sort}
              query={q}
              translations={{
                loading: t.loading,
                loadMore: t.loadMore,
                allLoaded: t.allLoaded,
                loadError: t.loadError,
                retry: t.retry,
              }}
            />
          ) : (
            /* 2ページ目以降: 従来のページネーション（SEO対策） */
            <>
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
                          alt={generateActressAltText({ name: performer.name, productCount: performer.productCount })}
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
            </>
          )
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="theme-text-muted">{t.noResults}</p>
          </div>
        )}
      </div>
    </main>
  );
}
