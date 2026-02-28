import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Trophy, Star, TrendingUp, Calendar, Users, ChevronRight } from 'lucide-react';

// ISR: getTranslations未使用 → パブリックキャッシュ有効
export const revalidate = 60;

interface Props {
  params: Promise<{ locale: string; year: string }>;
}

const metaTranslations = {
  ja: {
    metaTitle: (year: string) => `${year}年ベスト100 - 年間ランキング`,
    metaDescription: (year: string) =>
      `${year}年に発売されたAV作品の人気ランキングTOP100。評価・レビュー・閲覧数から総合的にランク付け。`,
    metaKeywords: (year: string) => [`${year}年`, 'ベスト', 'ランキング', 'AV', '人気作品', '年間ベスト'],
    ogTitle: (year: string) => `${year}年ベスト100`,
    ogDescription: (year: string) => `${year}年の人気作品ランキング`,
  },
  en: {
    metaTitle: (year: string) => `Best of ${year} - Annual Ranking`,
    metaDescription: (year: string) =>
      `Top 100 AV works released in ${year}. Comprehensive ranking based on ratings, reviews, and views.`,
    metaKeywords: (year: string) => [`${year}`, 'best', 'ranking', 'AV', 'popular', 'annual best'],
    ogTitle: (year: string) => `Best of ${year}`,
    ogDescription: (year: string) => `Popular works ranking of ${year}`,
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, year } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;

  return {
    title: mt.metaTitle(year),
    description: mt.metaDescription(year),
    keywords: mt.metaKeywords(year),
    openGraph: {
      title: mt.ogTitle(year),
      description: mt.ogDescription(year),
    },
  };
}

const translations = {
  ja: {
    title: '年ベスト100',
    subtitle: '年間人気作品ランキング',
    rank: '位',
    rating: '評価',
    reviews: 'レビュー',
    views: '閲覧',
    releaseDate: '発売日',
    performers: '出演者',
    viewDetails: '詳細を見る',
    otherYears: '他の年を見る',
    topActresses: 'この年の人気女優',
    topGenres: '人気ジャンル',
    prNotice: '当ページには広告・アフィリエイトリンクが含まれています',
  },
  en: {
    title: 'Best 100',
    subtitle: 'Annual Popular Works Ranking',
    rank: '',
    rating: 'Rating',
    reviews: 'Reviews',
    views: 'Views',
    releaseDate: 'Release',
    performers: 'Performers',
    viewDetails: 'View Details',
    otherYears: 'Other Years',
    topActresses: 'Top Actresses of the Year',
    topGenres: 'Popular Genres',
    prNotice: 'This page contains advertisements and affiliate links',
  },
};

interface RankedProduct {
  rank: number;
  id: number;
  normalized_product_id: string;
  title: string;
  release_date: string | null;
  default_thumbnail_url: string | null;
  avg_rating: number;
  review_count: number;
  view_count: number;
  performers: Array<{ id: number; name: string }> | null;
}

interface TopActress {
  id: number;
  name: string;
  profile_image_url: string | null;
  product_count: number;
}

interface TopGenre {
  id: number;
  name: string;
  product_count: number;
}

export default async function YearBestPage({ params }: Props) {
  const { locale, year: yearParam } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const db = getDb();

  const year = parseInt(yearParam, 10);
  const currentYear = new Date().getFullYear();

  // 有効な年かチェック
  if (isNaN(year) || year < 2000 || year > currentYear) {
    notFound();
  }

  let bestProducts: RankedProduct[];
  let topActresses: TopActress[];
  let topGenres: TopGenre[];

  try {
    // 年間ベスト100を取得
    // product_viewsテーブルはview_countカラムがなく、各閲覧が1行として記録される
    const bestProductsResult = await db.execute(sql`
      WITH product_view_counts AS (
        SELECT product_id, COUNT(*) as view_count
        FROM product_views
        GROUP BY product_id
      ),
      product_scores AS (
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          p.release_date,
          p.default_thumbnail_url,
          COALESCE(AVG(pr.rating), 0) as avg_rating,
          COUNT(DISTINCT pr.id) as review_count,
          COALESCE(pvc.view_count, 0) as view_count,
          (
            SELECT json_agg(json_build_object('id', pe.id, 'name', pe.name))
            FROM product_performers ppr
            JOIN performers pe ON ppr.performer_id = pe.id
            WHERE ppr.product_id = p.id
            LIMIT 3
          ) as performers,
          -- スコア計算
          (
            COALESCE(AVG(pr.rating), 3) * 25 +
            LEAST(COUNT(DISTINCT pr.id), 100) * 1.5 +
            LEAST(COALESCE(pvc.view_count, 0) / 50, 100)
          ) as score
        FROM products p
        LEFT JOIN product_reviews pr ON p.id = pr.product_id
        LEFT JOIN product_view_counts pvc ON p.id = pvc.product_id
        WHERE p.release_date IS NOT NULL
          AND EXTRACT(YEAR FROM p.release_date) = ${year}
          AND p.default_thumbnail_url IS NOT NULL
        GROUP BY p.id, pvc.view_count
        ORDER BY score DESC
        LIMIT 100
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY score DESC) as rank,
        *
      FROM product_scores
    `);

    // この年の人気女優TOP10
    const topActressesResult = await db.execute(sql`
      SELECT
        pe.id,
        pe.name,
        pe.profile_image_url,
        COUNT(DISTINCT pp.product_id) as product_count
      FROM performers pe
      JOIN product_performers pp ON pe.id = pp.performer_id
      JOIN products p ON pp.product_id = p.id
      WHERE p.release_date IS NOT NULL
        AND EXTRACT(YEAR FROM p.release_date) = ${year}
      GROUP BY pe.id, pe.name, pe.profile_image_url
      ORDER BY product_count DESC
      LIMIT 10
    `);

    // この年の人気ジャンルTOP10
    const topGenresResult = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        COUNT(DISTINCT pt.product_id) as product_count
      FROM tags t
      JOIN product_tags pt ON t.id = pt.tag_id
      JOIN products p ON pt.product_id = p.id
      WHERE p.release_date IS NOT NULL
        AND EXTRACT(YEAR FROM p.release_date) = ${year}
      GROUP BY t.id, t.name
      ORDER BY product_count DESC
      LIMIT 10
    `);

    bestProducts = bestProductsResult.rows as unknown as RankedProduct[];
    topActresses = topActressesResult.rows as unknown as TopActress[];
    topGenres = topGenresResult.rows as unknown as TopGenre[];
  } catch (error) {
    console.error(`[best-year] Error loading best of ${year}:`, error);
    notFound();
  }

  // 利用可能な年のリストを生成
  const availableYears = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto max-w-6xl px-4">
        {/* PR表記 */}
        <p className="mb-4 text-center text-xs text-gray-400">
          <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
          {t.prNotice}
        </p>

        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/20 px-4 py-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-300">{year}</span>
          </div>
          <h1 className="theme-text mb-2 text-3xl font-bold">
            {year}
            {t.title}
          </h1>
          <p className="theme-text-muted">{t.subtitle}</p>
        </div>

        {/* 年選択 */}
        <div className="mb-8">
          <h2 className="theme-text-muted mb-2 text-sm font-medium">{t.otherYears}</h2>
          <div className="flex flex-wrap gap-2">
            {availableYears.map((y) => (
              <Link
                key={y}
                href={localizedHref(`/best/${y}`, locale)}
                className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                  y === year ? 'bg-yellow-500 font-bold text-black' : 'theme-card hover:bg-gray-700'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* メインランキング */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {bestProducts.map((product, idx) => (
                <Link
                  key={product.id}
                  href={localizedHref(`/products/${product.normalized_product_id}`, locale)}
                  className="theme-card group flex gap-4 rounded-xl p-4 transition-all hover:ring-2 hover:ring-yellow-500/30"
                >
                  {/* ランク */}
                  <div className="flex w-12 flex-shrink-0 flex-col items-center justify-center">
                    <span
                      className={`text-2xl font-bold ${
                        idx < 3 ? 'text-yellow-400' : idx < 10 ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs text-gray-500">{t.rank}</span>
                  </div>

                  {/* サムネイル */}
                  <div className="aspect-video w-32 flex-shrink-0 overflow-hidden rounded-lg bg-gray-800">
                    {product.default_thumbnail_url ? (
                      <img
                        src={product.default_thumbnail_url}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-600">No Image</div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="min-w-0 flex-1">
                    <h3 className="theme-text line-clamp-2 font-medium transition-colors group-hover:text-yellow-400">
                      {product.title}
                    </h3>

                    {/* 出演者 */}
                    {product.performers && product.performers.length > 0 && (
                      <p className="mt-1 truncate text-sm text-pink-400">
                        {product.performers.map((p) => p.name).join(', ')}
                      </p>
                    )}

                    {/* メタ情報 */}
                    <div className="theme-text-muted mt-2 flex items-center gap-4 text-xs">
                      {product.avg_rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" />
                          {Number(product.avg_rating).toFixed(1)}
                        </span>
                      )}
                      {product.review_count > 0 && (
                        <span>
                          {product.review_count} {t.reviews}
                        </span>
                      )}
                      {product.release_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {product.release_date}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 flex-shrink-0 self-center text-gray-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* 人気女優 */}
            <div className="theme-card rounded-xl p-4">
              <h2 className="theme-text mb-4 flex items-center gap-2 font-bold">
                <Users className="h-5 w-5 text-pink-400" />
                {t.topActresses}
              </h2>
              <div className="space-y-2">
                {topActresses.map((actress, idx) => (
                  <Link
                    key={actress.id}
                    href={localizedHref(`/actress/${actress.id}`, locale)}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-700/50"
                  >
                    <span
                      className={`w-5 text-center text-sm font-bold ${idx < 3 ? 'text-yellow-400' : 'text-gray-500'}`}
                    >
                      {idx + 1}
                    </span>
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                      {actress.profile_image_url ? (
                        <img
                          src={actress.profile_image_url}
                          alt={actress.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-600">N/A</div>
                      )}
                    </div>
                    <span className="theme-text flex-1 truncate text-sm">{actress.name}</span>
                    <span className="text-xs text-gray-500">{actress.product_count}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* 人気ジャンル */}
            <div className="theme-card rounded-xl p-4">
              <h2 className="theme-text mb-4 flex items-center gap-2 font-bold">
                <TrendingUp className="h-5 w-5 text-green-400" />
                {t.topGenres}
              </h2>
              <div className="flex flex-wrap gap-2">
                {topGenres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={localizedHref(`/products?include=${genre.id}`, locale)}
                    className="rounded-full bg-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600"
                  >
                    {genre.name} ({genre.product_count})
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
