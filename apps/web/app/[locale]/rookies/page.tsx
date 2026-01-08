import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Star, Calendar, Film, TrendingUp, Award, Sparkles, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RookiePerformer {
  id: number;
  name: string;
  imageUrl: string | null;
  debutYear: number;
  debutMonth: number | null;
  productCount: number;
  latestProductTitle: string | null;
  latestProductDate: string | null;
  latestProductId: number | null;
  avgRating: number | null;
  totalReviews: number;
  tags: string[];
}

interface MonthlyDebut {
  month: string;
  year: number;
  monthNum: number;
  performers: RookiePerformer[];
}

interface RookiesData {
  thisYearRookies: RookiePerformer[];
  lastYearRookies: RookiePerformer[];
  monthlyDebuts: MonthlyDebut[];
  totalRookies: number;
  avgProductsPerRookie: number;
  topGenres: Array<{ name: string; count: number }>;
}

async function getRookiesData(): Promise<RookiesData> {
  const db = getDb();
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  // 今年デビューの新人（詳細情報付き）
  const thisYearResult = await db.execute(sql`
    WITH performer_products AS (
      SELECT
        pp.performer_id,
        p.id as product_id,
        p.title,
        p.release_date,
        p.rating,
        p.review_count,
        ROW_NUMBER() OVER (PARTITION BY pp.performer_id ORDER BY p.release_date DESC) as rn
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
    ),
    performer_tags AS (
      SELECT
        pp.performer_id,
        array_agg(DISTINCT t.name ORDER BY t.name) as tags
      FROM product_performers pp
      INNER JOIN product_tags pt ON pp.product_id = pt.product_id
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE t.category = 'genre'
      GROUP BY pp.performer_id
    )
    SELECT
      pf.id,
      pf.name,
      pf.profile_image_url as "imageUrl",
      pf.debut_year as "debutYear",
      EXTRACT(MONTH FROM MIN(pr.release_date))::int as "debutMonth",
      COUNT(DISTINCT pr.product_id)::int as "productCount",
      (SELECT title FROM performer_products WHERE performer_id = pf.id AND rn = 1) as "latestProductTitle",
      (SELECT release_date FROM performer_products WHERE performer_id = pf.id AND rn = 1)::text as "latestProductDate",
      (SELECT product_id FROM performer_products WHERE performer_id = pf.id AND rn = 1) as "latestProductId",
      AVG(pr.rating) as "avgRating",
      COALESCE(SUM(pr.review_count), 0)::int as "totalReviews",
      COALESCE(pt.tags, ARRAY[]::text[]) as tags
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products pr ON pp.product_id = pr.id
    LEFT JOIN performer_tags pt ON pf.id = pt.performer_id
    WHERE pf.debut_year = ${currentYear}
    GROUP BY pf.id, pf.name, pf.profile_image_url, pf.debut_year, pt.tags
    ORDER BY "productCount" DESC, "avgRating" DESC NULLS LAST
    LIMIT 50
  `);

  // 昨年デビューの新人
  const lastYearResult = await db.execute(sql`
    WITH performer_products AS (
      SELECT
        pp.performer_id,
        p.id as product_id,
        p.title,
        p.release_date,
        p.rating,
        p.review_count,
        ROW_NUMBER() OVER (PARTITION BY pp.performer_id ORDER BY p.release_date DESC) as rn
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
    ),
    performer_tags AS (
      SELECT
        pp.performer_id,
        array_agg(DISTINCT t.name ORDER BY t.name) as tags
      FROM product_performers pp
      INNER JOIN product_tags pt ON pp.product_id = pt.product_id
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE t.category = 'genre'
      GROUP BY pp.performer_id
    )
    SELECT
      pf.id,
      pf.name,
      pf.profile_image_url as "imageUrl",
      pf.debut_year as "debutYear",
      EXTRACT(MONTH FROM MIN(pr.release_date))::int as "debutMonth",
      COUNT(DISTINCT pr.product_id)::int as "productCount",
      (SELECT title FROM performer_products WHERE performer_id = pf.id AND rn = 1) as "latestProductTitle",
      (SELECT release_date FROM performer_products WHERE performer_id = pf.id AND rn = 1)::text as "latestProductDate",
      (SELECT product_id FROM performer_products WHERE performer_id = pf.id AND rn = 1) as "latestProductId",
      AVG(pr.rating) as "avgRating",
      COALESCE(SUM(pr.review_count), 0)::int as "totalReviews",
      COALESCE(pt.tags, ARRAY[]::text[]) as tags
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products pr ON pp.product_id = pr.id
    LEFT JOIN performer_tags pt ON pf.id = pt.performer_id
    WHERE pf.debut_year = ${lastYear}
    GROUP BY pf.id, pf.name, pf.profile_image_url, pf.debut_year, pt.tags
    ORDER BY "productCount" DESC, "avgRating" DESC NULLS LAST
    LIMIT 50
  `);

  // 月別デビュー（直近6ヶ月）
  const monthlyResult = await db.execute(sql`
    WITH monthly_debuts AS (
      SELECT
        pf.id,
        pf.name,
        pf.profile_image_url as "imageUrl",
        pf.debut_year as "debutYear",
        MIN(p.release_date) as debut_date,
        COUNT(DISTINCT pp.product_id)::int as "productCount"
      FROM performers pf
      INNER JOIN product_performers pp ON pf.id = pp.performer_id
      INNER JOIN products p ON pp.product_id = p.id
      WHERE pf.debut_year >= ${lastYear}
      GROUP BY pf.id, pf.name, pf.profile_image_url, pf.debut_year
      HAVING MIN(p.release_date) >= CURRENT_DATE - INTERVAL '6 months'
    )
    SELECT
      id,
      name,
      "imageUrl",
      "debutYear",
      EXTRACT(MONTH FROM debut_date)::int as "debutMonth",
      EXTRACT(YEAR FROM debut_date)::int as year,
      "productCount"
    FROM monthly_debuts
    ORDER BY debut_date DESC
  `);

  // 統計情報
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT pf.id)::int as total_rookies,
      AVG(sub.product_count)::float as avg_products
    FROM performers pf
    INNER JOIN (
      SELECT pp.performer_id, COUNT(*)::int as product_count
      FROM product_performers pp
      GROUP BY pp.performer_id
    ) sub ON pf.id = sub.performer_id
    WHERE pf.debut_year >= ${lastYear}
  `);

  // 新人に多いジャンル
  const genreResult = await db.execute(sql`
    SELECT t.name, COUNT(DISTINCT pp.performer_id)::int as count
    FROM tags t
    INNER JOIN product_tags pt ON t.id = pt.tag_id
    INNER JOIN product_performers pp ON pt.product_id = pp.product_id
    INNER JOIN performers pf ON pp.performer_id = pf.id
    WHERE pf.debut_year >= ${lastYear}
      AND t.category = 'genre'
    GROUP BY t.name
    ORDER BY count DESC
    LIMIT 10
  `);

  const thisYearRookies = (thisYearResult.rows as Array<RookiePerformer>).map(row => ({
    ...row,
    avgRating: row.avgRating ? Number(row.avgRating) : null,
    tags: row.tags || [],
  }));

  const lastYearRookies = (lastYearResult.rows as Array<RookiePerformer>).map(row => ({
    ...row,
    avgRating: row.avgRating ? Number(row.avgRating) : null,
    tags: row.tags || [],
  }));

  // 月別にグループ化
  const monthlyMap = new Map<string, RookiePerformer[]>();
  for (const row of monthlyResult.rows as Array<RookiePerformer & { year: number }>) {
    const key = `${row.year}-${row.debutMonth}`;
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, []);
    }
    monthlyMap.get(key)!.push(row);
  }

  const monthNames = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const monthlyDebuts: MonthlyDebut[] = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, performers]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        month: monthNames[month],
        year,
        monthNum: month,
        performers,
      };
    });

  const stats = statsResult.rows[0] as { total_rookies: number; avg_products: number };

  return {
    thisYearRookies,
    lastYearRookies,
    monthlyDebuts,
    totalRookies: stats?.total_rookies || 0,
    avgProductsPerRookie: stats?.avg_products || 0,
    topGenres: genreResult.rows as Array<{ name: string; count: number }>,
  };
}

const translations = {
  ja: {
    title: '新人デビュー特集',
    subtitle: '今年・昨年デビューの注目新人女優を紹介',
    thisYear: '年デビュー',
    lastYear: '年デビュー',
    monthlyDebut: '月別デビュー',
    works: '作品',
    rating: '評価',
    reviews: 'レビュー',
    latest: '最新作',
    totalRookies: '新人総数',
    avgProducts: '平均作品数',
    topGenres: '新人に多いジャンル',
    viewAll: 'すべて見る',
    noRookies: 'データがありません',
    debut: 'デビュー',
    people: '名',
    viewProfile: 'プロフィールを見る',
    stats: '新人統計',
  },
  en: {
    title: 'New Debuts Spotlight',
    subtitle: 'Featuring notable newcomers from this year and last year',
    thisYear: ' Debuts',
    lastYear: ' Debuts',
    monthlyDebut: 'Monthly Debuts',
    works: 'works',
    rating: 'Rating',
    reviews: 'reviews',
    latest: 'Latest',
    totalRookies: 'Total Rookies',
    avgProducts: 'Avg. Works',
    topGenres: 'Popular Genres',
    viewAll: 'View All',
    noRookies: 'No data available',
    debut: 'Debut',
    people: '',
    viewProfile: 'View Profile',
    stats: 'Rookie Stats',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(
    t.title,
    t.subtitle,
    undefined,
    '/rookies',
    undefined,
    locale,
  );
}

export default async function RookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations('nav');
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const data = await getRookiesData();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.subtitle,
  };

  function RookieCard({ performer, rank }: { performer: RookiePerformer; rank?: number }) {
    return (
      <Link
        href={localizedHref(`/actress/${performer.id}`, locale)}
        className="group theme-card rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all"
      >
        <div className="relative">
          <div className="aspect-[3/4] bg-gray-700 overflow-hidden">
            {performer.imageUrl ? (
              <img
                src={performer.imageUrl}
                alt={performer.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl">
                👤
              </div>
            )}
          </div>
          {rank && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-rose-600 to-purple-600 text-white text-sm font-bold px-2 py-1 rounded">
              #{rank}
            </div>
          )}
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {performer.debutYear}年{t.debut}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold theme-text group-hover:text-rose-400 transition-colors mb-2">
            {performer.name}
          </h3>
          <div className="flex items-center gap-2 text-sm theme-text-muted mb-2">
            <Film className="w-4 h-4" />
            <span>{performer.productCount} {t.works}</span>
            {performer.avgRating && (
              <>
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{performer.avgRating.toFixed(1)}</span>
              </>
            )}
          </div>
          {performer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {performer.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-300">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {performer.latestProductTitle && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs theme-text-muted mb-1">{t.latest}:</div>
              <div className="text-sm theme-text line-clamp-2">{performer.latestProductTitle}</div>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <>
      <JsonLD data={structuredData} />
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t.title },
            ]}
            className="mb-4"
          />

          {/* PR表記 */}
          <p className="text-xs theme-text-muted mb-6">
            <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-600 to-purple-600 text-white px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-5 h-5" />
              <span className="font-bold">NEW FACES</span>
            </div>
            <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="theme-card rounded-lg p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-rose-400" />
              <div className="text-3xl font-bold theme-text">{data.totalRookies}</div>
              <div className="text-sm theme-text-muted">{t.totalRookies}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Film className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <div className="text-3xl font-bold theme-text">{data.avgProductsPerRookie.toFixed(1)}</div>
              <div className="text-sm theme-text-muted">{t.avgProducts}</div>
            </div>
            <div className="theme-card rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-sm font-bold theme-text">{t.topGenres}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.topGenres.slice(0, 5).map(genre => (
                  <span key={genre.name} className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-300">
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 今年デビュー */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold theme-text flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                {currentYear}{t.thisYear}
              </h2>
              <span className="text-sm theme-text-muted">{data.thisYearRookies.length}{t.people}</span>
            </div>
            {data.thisYearRookies.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {data.thisYearRookies.slice(0, 12).map((performer, i) => (
                  <RookieCard key={performer.id} performer={performer} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="theme-card rounded-lg p-8 text-center theme-text-muted">
                {t.noRookies}
              </div>
            )}
          </section>

          {/* 昨年デビュー */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold theme-text flex items-center gap-2">
                <Star className="w-6 h-6 text-purple-400" />
                {lastYear}{t.lastYear}
              </h2>
              <span className="text-sm theme-text-muted">{data.lastYearRookies.length}{t.people}</span>
            </div>
            {data.lastYearRookies.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {data.lastYearRookies.slice(0, 12).map((performer, i) => (
                  <RookieCard key={performer.id} performer={performer} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="theme-card rounded-lg p-8 text-center theme-text-muted">
                {t.noRookies}
              </div>
            )}
          </section>

          {/* 月別デビュー */}
          {data.monthlyDebuts.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold theme-text mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-400" />
                {t.monthlyDebut}
              </h2>
              <div className="space-y-6">
                {data.monthlyDebuts.map(monthly => (
                  <div key={`${monthly.year}-${monthly.monthNum}`} className="theme-card rounded-lg p-6">
                    <h3 className="text-lg font-bold theme-text mb-4">
                      {monthly.year}年{monthly.month} ({monthly.performers.length}{t.people})
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {monthly.performers.map(performer => (
                        <Link
                          key={performer.id}
                          href={localizedHref(`/actress/${performer.id}`, locale)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                        >
                          {performer.imageUrl ? (
                            <img
                              src={performer.imageUrl}
                              alt={performer.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs">👤</div>
                          )}
                          <span className="theme-text">{performer.name}</span>
                          <span className="text-xs theme-text-muted">({performer.productCount}{t.works})</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
