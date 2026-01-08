import { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Trophy, Star, TrendingUp, Calendar, Users, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, year } = await params;
  const isJa = locale === 'ja';

  return {
    title: isJa ? `${year}年ベスト100 - 年間ランキング` : `Best of ${year} - Annual Ranking`,
    description: isJa
      ? `${year}年に発売されたAV作品の人気ランキングTOP100。評価・レビュー・閲覧数から総合的にランク付け。`
      : `Top 100 AV works released in ${year}. Comprehensive ranking based on ratings, reviews, and views.`,
    keywords: isJa
      ? [`${year}年`, 'ベスト', 'ランキング', 'AV', '人気作品', '年間ベスト']
      : [`${year}`, 'best', 'ranking', 'AV', 'popular', 'annual best'],
    openGraph: {
      title: isJa ? `${year}年ベスト100` : `Best of ${year}`,
      description: isJa ? `${year}年の人気作品ランキング` : `Popular works ranking of ${year}`,
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
    return (
      <main className="theme-body min-h-screen py-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold theme-text">Invalid Year</h1>
          <p className="theme-text-muted mt-2">Please select a valid year between 2000 and {currentYear}.</p>
        </div>
      </main>
    );
  }

  // 年間ベスト100を取得
  const bestProductsResult = await db.execute(sql`
    WITH product_scores AS (
      SELECT
        p.id,
        p.normalized_product_id,
        p.title,
        p.release_date,
        p.default_thumbnail_url,
        COALESCE(AVG(pr.rating), 0) as avg_rating,
        COUNT(pr.id) as review_count,
        COALESCE(SUM(pv.view_count), 0) as view_count,
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
          LEAST(COUNT(pr.id), 100) * 1.5 +
          LEAST(COALESCE(SUM(pv.view_count), 0) / 50, 100)
        ) as score
      FROM products p
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      LEFT JOIN product_views pv ON p.id = pv.product_id
      WHERE p.release_date IS NOT NULL
        AND EXTRACT(YEAR FROM p.release_date) = ${year}
        AND p.default_thumbnail_url IS NOT NULL
      GROUP BY p.id
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

  const bestProducts = bestProductsResult.rows as RankedProduct[];
  const topActresses = topActressesResult.rows as TopActress[];
  const topGenres = topGenresResult.rows as TopGenre[];

  // 利用可能な年のリストを生成
  const availableYears = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* PR表記 */}
        <p className="text-xs text-gray-400 mb-4 text-center">
          <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
          {locale === 'ja' ? '当ページには広告・アフィリエイトリンクが含まれています' : 'This page contains advertisements and affiliate links'}
        </p>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-300 font-bold text-2xl">{year}</span>
          </div>
          <h1 className="text-3xl font-bold theme-text mb-2">{year}{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
        </div>

        {/* 年選択 */}
        <div className="mb-8">
          <h2 className="text-sm font-medium theme-text-muted mb-2">{t.otherYears}</h2>
          <div className="flex flex-wrap gap-2">
            {availableYears.map((y) => (
              <Link
                key={y}
                href={localizedHref(`/best/${y}`, locale)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  y === year
                    ? 'bg-yellow-500 text-black font-bold'
                    : 'theme-card hover:bg-gray-700'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* メインランキング */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {bestProducts.map((product, idx) => (
                <Link
                  key={product.id}
                  href={localizedHref(`/products/${product.normalized_product_id}`, locale)}
                  className="flex gap-4 p-4 rounded-xl theme-card hover:ring-2 hover:ring-yellow-500/30 transition-all group"
                >
                  {/* ランク */}
                  <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${
                      idx < 3 ? 'text-yellow-400' : idx < 10 ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-xs text-gray-500">{t.rank}</span>
                  </div>

                  {/* サムネイル */}
                  <div className="flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-gray-800">
                    {product.default_thumbnail_url ? (
                      <img
                        src={product.default_thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium theme-text line-clamp-2 group-hover:text-yellow-400 transition-colors">
                      {product.title}
                    </h3>

                    {/* 出演者 */}
                    {product.performers && product.performers.length > 0 && (
                      <p className="text-sm text-pink-400 mt-1 truncate">
                        {product.performers.map(p => p.name).join(', ')}
                      </p>
                    )}

                    {/* メタ情報 */}
                    <div className="flex items-center gap-4 mt-2 text-xs theme-text-muted">
                      {product.avg_rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400" />
                          {Number(product.avg_rating).toFixed(1)}
                        </span>
                      )}
                      {product.review_count > 0 && (
                        <span>{product.review_count} {t.reviews}</span>
                      )}
                      {product.release_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {product.release_date}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 self-center" />
                </Link>
              ))}
            </div>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* 人気女優 */}
            <div className="rounded-xl theme-card p-4">
              <h2 className="font-bold theme-text mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-400" />
                {t.topActresses}
              </h2>
              <div className="space-y-2">
                {topActresses.map((actress, idx) => (
                  <Link
                    key={actress.id}
                    href={localizedHref(`/actress/${actress.id}`, locale)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <span className={`w-5 text-center text-sm font-bold ${
                      idx < 3 ? 'text-yellow-400' : 'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
                      {actress.profile_image_url ? (
                        <img
                          src={actress.profile_image_url}
                          alt={actress.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                          N/A
                        </div>
                      )}
                    </div>
                    <span className="text-sm theme-text truncate flex-1">{actress.name}</span>
                    <span className="text-xs text-gray-500">{actress.product_count}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* 人気ジャンル */}
            <div className="rounded-xl theme-card p-4">
              <h2 className="font-bold theme-text mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                {t.topGenres}
              </h2>
              <div className="flex flex-wrap gap-2">
                {topGenres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={localizedHref(`/products?include=${genre.id}`, locale)}
                    className="px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
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
