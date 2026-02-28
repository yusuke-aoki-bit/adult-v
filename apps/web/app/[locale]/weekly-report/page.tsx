import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { TrendingUp, TrendingDown, Minus, Calendar, Star, Users, Film, Award } from 'lucide-react';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

interface TrendItem {
  id: number;
  name: string;
  count: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopProduct {
  id: number;
  title: string;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  performers: string[];
  releaseDate: string | null;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  totalReleases: number;
  previousWeekReleases: number;
  trendingTags: TrendItem[];
  trendingPerformers: TrendItem[];
  topRatedProducts: TopProduct[];
  newDebutPerformers: Array<{ id: number; name: string; productCount: number }>;
  insights: string[];
}

async function getWeeklyReportData(locale: string): Promise<WeeklyData> {
  const db = getDb();
  const now = new Date();

  // 今週の開始日（日曜日）
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // 先週
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

  // 今週のリリース数
  const currentReleasesResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products
    WHERE release_date >= ${weekStart.toISOString().split('T')[0]}
  `);
  const totalReleases = Number((currentReleasesResult.rows[0] as { count: number })?.count || 0);

  // 先週のリリース数
  const prevReleasesResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products
    WHERE release_date >= ${prevWeekStart.toISOString().split('T')[0]}
      AND release_date <= ${prevWeekEnd.toISOString().split('T')[0]}
  `);
  const previousWeekReleases = Number((prevReleasesResult.rows[0] as { count: number })?.count || 0);

  // トレンドタグ（今週 vs 先週）
  const currentTagsResult = await db.execute(sql`
    SELECT t.id, t.name, COUNT(DISTINCT pt.product_id) as count
    FROM tags t
    INNER JOIN product_tags pt ON t.id = pt.tag_id
    INNER JOIN products p ON pt.product_id = p.id
    WHERE p.release_date >= ${weekStart.toISOString().split('T')[0]}
      AND t.category = 'genre'
    GROUP BY t.id, t.name
    ORDER BY count DESC
    LIMIT 10
  `);

  const prevTagsResult = await db.execute(sql`
    SELECT t.id, t.name, COUNT(DISTINCT pt.product_id) as count
    FROM tags t
    INNER JOIN product_tags pt ON t.id = pt.tag_id
    INNER JOIN products p ON pt.product_id = p.id
    WHERE p.release_date >= ${prevWeekStart.toISOString().split('T')[0]}
      AND p.release_date <= ${prevWeekEnd.toISOString().split('T')[0]}
      AND t.category = 'genre'
    GROUP BY t.id, t.name
  `);

  const prevTagMap = new Map<string, number>();
  for (const row of prevTagsResult.rows as Array<{ name: string; count: number }>) {
    prevTagMap.set(row.name, Number(row.count));
  }

  const trendingTags: TrendItem[] = (currentTagsResult.rows as Array<{ id: number; name: string; count: number }>).map(
    (row) => {
      const currentCount = Number(row.count);
      const prevCount = prevTagMap.get(row.name) || 0;
      const change = prevCount > 0 ? Math.round(((currentCount - prevCount) / prevCount) * 100) : 100;
      return {
        id: row.id,
        name: row.name,
        count: currentCount,
        change,
        trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
      };
    },
  );

  // トレンド女優
  const currentPerformersResult = await db.execute(sql`
    SELECT pf.id, pf.name, COUNT(DISTINCT pp.product_id) as count
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products p ON pp.product_id = p.id
    WHERE p.release_date >= ${weekStart.toISOString().split('T')[0]}
    GROUP BY pf.id, pf.name
    ORDER BY count DESC
    LIMIT 10
  `);

  const prevPerformersResult = await db.execute(sql`
    SELECT pf.id, pf.name, COUNT(DISTINCT pp.product_id) as count
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products p ON pp.product_id = p.id
    WHERE p.release_date >= ${prevWeekStart.toISOString().split('T')[0]}
      AND p.release_date <= ${prevWeekEnd.toISOString().split('T')[0]}
    GROUP BY pf.id, pf.name
  `);

  const prevPerformerMap = new Map<string, number>();
  for (const row of prevPerformersResult.rows as Array<{ name: string; count: number }>) {
    prevPerformerMap.set(row.name, Number(row.count));
  }

  const trendingPerformers: TrendItem[] = (
    currentPerformersResult.rows as Array<{ id: number; name: string; count: number }>
  ).map((row) => {
    const currentCount = Number(row.count);
    const prevCount = prevPerformerMap.get(row.name) || 0;
    const change = prevCount > 0 ? Math.round(((currentCount - prevCount) / prevCount) * 100) : 100;
    return {
      id: row.id,
      name: row.name,
      count: currentCount,
      change,
      trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
    };
  });

  // 今週の高評価作品
  // productsテーブルにはrating/review_count/thumbnailがないため、product_reviewsとdefault_thumbnail_urlを使用
  const topRatedResult = await db.execute(sql`
    WITH product_stats AS (
      SELECT
        product_id,
        AVG(rating::float) as avg_rating,
        COUNT(*) as review_count
      FROM product_reviews
      GROUP BY product_id
    )
    SELECT
      p.id, p.title, p.default_thumbnail_url as "imageUrl",
      ps.avg_rating as rating, ps.review_count as "reviewCount",
      p.release_date::text as "releaseDate",
      COALESCE(
        (SELECT array_agg(pf.name) FROM product_performers pp
         INNER JOIN performers pf ON pp.performer_id = pf.id
         WHERE pp.product_id = p.id),
        ARRAY[]::text[]
      ) as performers
    FROM products p
    INNER JOIN product_stats ps ON p.id = ps.product_id
    WHERE p.release_date >= ${weekStart.toISOString().split('T')[0]}
      AND ps.avg_rating IS NOT NULL
      AND ps.avg_rating > 0
    ORDER BY ps.avg_rating DESC, ps.review_count DESC NULLS LAST
    LIMIT 5
  `);

  const topRatedProducts: TopProduct[] = (
    topRatedResult.rows as Array<{
      id: number;
      title: string;
      imageUrl: string | null;
      rating: number | null;
      reviewCount: number | null;
      performers: string[];
      releaseDate: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    imageUrl: row.imageUrl,
    rating: row.rating,
    reviewCount: row.reviewCount,
    performers: row.performers || [],
    releaseDate: row.releaseDate,
  }));

  // 今週デビューの新人（初作品がリリース）
  const newDebutResult = await db.execute(sql`
    SELECT pf.id, pf.name, COUNT(pp.product_id) as "productCount"
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products p ON pp.product_id = p.id
    WHERE pf.id IN (
      SELECT pf2.id FROM performers pf2
      INNER JOIN product_performers pp2 ON pf2.id = pp2.performer_id
      INNER JOIN products p2 ON pp2.product_id = p2.id
      GROUP BY pf2.id
      HAVING MIN(p2.release_date) >= ${weekStart.toISOString().split('T')[0]}
    )
    GROUP BY pf.id, pf.name
    ORDER BY "productCount" DESC
    LIMIT 5
  `);

  const newDebutPerformers = (newDebutResult.rows as Array<{ id: number; name: string; productCount: number }>).map(
    (row) => ({
      id: row.id,
      name: row.name,
      productCount: Number(row.productCount),
    }),
  );

  // インサイト生成
  const insightTranslations = {
    ja: {
      releasesUp: (pct: number) => `今週のリリース数は先週比${pct}%増加`,
      releasesDown: (pct: number) => `今週のリリース数は先週比${pct}%減少`,
      tagsRising: (tags: string[]) => `「${tags.join('」「')}」が急上昇中`,
      newDebuts: (count: number) => `今週${count}名の新人がデビュー`,
    },
    en: {
      releasesUp: (pct: number) => `Releases up ${pct}% from last week`,
      releasesDown: (pct: number) => `Releases down ${pct}% from last week`,
      tagsRising: (tags: string[]) => `"${tags.join('", "')}" trending up`,
      newDebuts: (count: number) => `${count} new performers debuted this week`,
    },
  };
  const it = insightTranslations[locale as keyof typeof insightTranslations] || insightTranslations.ja;
  const insights: string[] = [];

  const releaseChange =
    previousWeekReleases > 0 ? Math.round(((totalReleases - previousWeekReleases) / previousWeekReleases) * 100) : 0;

  if (releaseChange > 10) {
    insights.push(it.releasesUp(releaseChange));
  } else if (releaseChange < -10) {
    insights.push(it.releasesDown(Math.abs(releaseChange)));
  }

  const risingTags = trendingTags.filter((t) => t.trend === 'up').slice(0, 2);
  if (risingTags.length > 0) {
    insights.push(it.tagsRising(risingTags.map((t) => t.name)));
  }

  if (newDebutPerformers.length > 0) {
    insights.push(it.newDebuts(newDebutPerformers.length));
  }

  return {
    weekStart: weekStart.toISOString().split('T')[0]!,
    weekEnd: weekEnd.toISOString().split('T')[0]!,
    totalReleases,
    previousWeekReleases,
    trendingTags,
    trendingPerformers,
    topRatedProducts,
    newDebutPerformers,
    insights,
  };
}

const translations = {
  ja: {
    title: '週間トレンドレポート',
    subtitle: '今週の業界動向をAIが自動分析',
    weekOf: '週',
    totalReleases: '今週のリリース',
    vsLastWeek: '先週比',
    works: '作品',
    trendingGenres: '急上昇ジャンル',
    trendingActresses: '注目の女優',
    topRated: '今週の高評価作品',
    newDebuts: '今週デビューの新人',
    insights: '今週のインサイト',
    noData: 'データがありません',
    viewDetails: '詳細を見る',
    rating: '評価',
    reviews: 'レビュー',
  },
  en: {
    title: 'Weekly Trend Report',
    subtitle: 'AI-powered industry analysis',
    weekOf: 'Week of',
    totalReleases: 'Releases This Week',
    vsLastWeek: 'vs last week',
    works: 'works',
    trendingGenres: 'Trending Genres',
    trendingActresses: 'Trending Actresses',
    topRated: 'Top Rated This Week',
    newDebuts: 'New Debuts This Week',
    insights: 'Weekly Insights',
    noData: 'No data available',
    viewDetails: 'View Details',
    rating: 'Rating',
    reviews: 'reviews',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(t.title, t.subtitle, undefined, '/weekly-report', undefined, locale);
}

export default async function WeeklyReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const data = await getWeeklyReportData(locale);

  const releaseChange =
    data.previousWeekReleases > 0
      ? Math.round(((data.totalReleases - data.previousWeekReleases) / data.previousWeekReleases) * 100)
      : 0;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: t.title,
    datePublished: data.weekStart,
    dateModified: new Date().toISOString(),
    description: t.subtitle,
  };

  function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  }

  return (
    <>
      <JsonLD data={structuredData} />
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb
            items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: t.title }]}
            className="mb-4"
          />

          {/* PR表記 */}
          <p className="theme-text-muted mb-6 text-xs">
            <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

          {/* ヘッダー */}
          <div className="mb-8 text-center">
            <h1 className="theme-text mb-2 text-3xl font-bold">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
            <div className="theme-text-muted mt-3 flex items-center justify-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>
                {t.weekOf}: {data.weekStart} 〜 {data.weekEnd}
              </span>
            </div>
          </div>

          {/* サマリーカード */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="theme-card rounded-lg p-6 text-center">
              <Film className="mx-auto mb-2 h-8 w-8 text-fuchsia-400" />
              <div className="theme-text text-3xl font-bold">{data.totalReleases}</div>
              <div className="theme-text-muted text-sm">{t.totalReleases}</div>
              <div className={`mt-1 text-sm ${releaseChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {releaseChange >= 0 ? '+' : ''}
                {releaseChange}% {t.vsLastWeek}
              </div>
            </div>

            <div className="theme-card rounded-lg p-6 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-purple-400" />
              <div className="theme-text text-3xl font-bold">{data.newDebutPerformers.length}</div>
              <div className="theme-text-muted text-sm">{t.newDebuts}</div>
            </div>

            <div className="theme-card rounded-lg p-6 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-yellow-400" />
              <div className="theme-text text-3xl font-bold">{data.topRatedProducts[0]?.rating?.toFixed(1) || '-'}</div>
              <div className="theme-text-muted text-sm">{t.topRated}</div>
            </div>
          </div>

          {/* インサイト */}
          {data.insights.length > 0 && (
            <div className="theme-card mb-8 rounded-lg p-6">
              <h2 className="theme-text mb-4 flex items-center gap-2 text-lg font-bold">
                <Award className="h-5 w-5 text-yellow-400" />
                {t.insights}
              </h2>
              <ul className="space-y-2">
                {data.insights.map((insight, i) => (
                  <li key={i} className="theme-text flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* トレンドジャンル */}
            <div className="theme-card rounded-lg p-6">
              <h2 className="theme-text mb-4 text-lg font-bold">{t.trendingGenres}</h2>
              <div className="space-y-3">
                {data.trendingTags.map((tag, i) => (
                  <Link
                    key={tag.id}
                    href={localizedHref(`/products?tags=${tag.id}`, locale)}
                    className="flex items-center justify-between rounded-lg bg-white/5 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-500">#{i + 1}</span>
                      <span className="theme-text">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="theme-text-muted text-sm">
                        {tag.count} {t.works}
                      </span>
                      <TrendIcon trend={tag.trend} />
                      <span className={`text-xs ${tag.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tag.change >= 0 ? '+' : ''}
                        {tag.change}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* トレンド女優 */}
            <div className="theme-card rounded-lg p-6">
              <h2 className="theme-text mb-4 text-lg font-bold">{t.trendingActresses}</h2>
              <div className="space-y-3">
                {data.trendingPerformers.map((performer, i) => (
                  <Link
                    key={performer.id}
                    href={localizedHref(`/actress/${performer.id}`, locale)}
                    className="flex items-center justify-between rounded-lg bg-white/5 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-500">#{i + 1}</span>
                      <span className="theme-text">{performer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="theme-text-muted text-sm">
                        {performer.count} {t.works}
                      </span>
                      <TrendIcon trend={performer.trend} />
                      <span className={`text-xs ${performer.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {performer.change >= 0 ? '+' : ''}
                        {performer.change}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 高評価作品 */}
          {data.topRatedProducts.length > 0 && (
            <div className="theme-card mt-8 rounded-lg p-6">
              <h2 className="theme-text mb-4 text-lg font-bold">{t.topRated}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {data.topRatedProducts.map((product) => (
                  <Link key={product.id} href={localizedHref(`/products/${product.id}`, locale)} className="group">
                    <div className="mb-2 aspect-[2/3] overflow-hidden rounded-lg bg-gray-700">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-500">No Image</div>
                      )}
                    </div>
                    <h3 className="theme-text line-clamp-2 text-sm transition-colors group-hover:text-fuchsia-400">
                      {product.title}
                    </h3>
                    {product.rating && (
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-yellow-400">{product.rating.toFixed(1)}</span>
                        {product.reviewCount && (
                          <span className="theme-text-muted text-xs">({product.reviewCount})</span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 新人デビュー */}
          {data.newDebutPerformers.length > 0 && (
            <div className="theme-card mt-8 rounded-lg p-6">
              <h2 className="theme-text mb-4 text-lg font-bold">{t.newDebuts}</h2>
              <div className="flex flex-wrap gap-3">
                {data.newDebutPerformers.map((performer) => (
                  <Link
                    key={performer.id}
                    href={localizedHref(`/actress/${performer.id}`, locale)}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-2 text-white transition-colors hover:from-fuchsia-500 hover:to-purple-500"
                  >
                    <span>{performer.name}</span>
                    <span className="text-xs opacity-80">
                      ({performer.productCount}
                      {t.works})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
