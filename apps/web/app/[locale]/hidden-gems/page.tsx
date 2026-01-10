import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Star, Eye, EyeOff, Gem, TrendingUp, MessageCircle, Sparkles, ThumbsUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface HiddenGem {
  id: number;
  title: string;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  viewCount: number;
  releaseDate: string;
  performers: string[];
  genres: string[];
  aiDescription: string | null;
  whyHidden: string;
}

interface HiddenGemsData {
  highRatedLowViews: HiddenGem[];
  underratedClassics: HiddenGem[];
  sleepersWithReviews: HiddenGem[];
  recentDiscoveries: HiddenGem[];
  stats: {
    totalHiddenGems: number;
    avgRating: number;
    avgViews: number;
  };
}

async function getHiddenGemsData(locale: string): Promise<HiddenGemsData> {
  const db = getDb();

  // 高評価だが視聴数が少ない作品（隠れた名作の代表例）
  const highRatedLowViewsResult = await db.execute(sql`
    WITH product_views_count AS (
      SELECT product_id, COUNT(*) as view_count
      FROM product_views
      GROUP BY product_id
    ),
    avg_views AS (
      SELECT AVG(view_count) as avg_view FROM product_views_count
    )
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.rating,
      p.review_count as "reviewCount",
      COALESCE(pvc.view_count, 0)::int as "viewCount",
      p.release_date::text as "releaseDate",
      p.ai_short_description as "aiDescription",
      COALESCE(
        (SELECT array_agg(pf.name ORDER BY pf.name) FROM product_performers pp
         INNER JOIN performers pf ON pp.performer_id = pf.id
         WHERE pp.product_id = p.id),
        ARRAY[]::text[]
      ) as performers,
      COALESCE(
        (SELECT array_agg(t.name ORDER BY t.name) FROM product_tags pt
         INNER JOIN tags t ON pt.tag_id = t.id
         WHERE pt.product_id = p.id AND t.category = 'genre'),
        ARRAY[]::text[]
      ) as genres
    FROM products p
    LEFT JOIN product_views_count pvc ON p.id = pvc.product_id
    CROSS JOIN avg_views av
    WHERE p.rating >= 4.0
      AND p.review_count >= 3
      AND COALESCE(pvc.view_count, 0) < av.avg_view * 0.5
    ORDER BY p.rating DESC, p.review_count DESC
    LIMIT 10
  `);

  // 1年以上前の名作（クラシック）
  const underratedClassicsResult = await db.execute(sql`
    WITH product_views_count AS (
      SELECT product_id, COUNT(*) as view_count
      FROM product_views
      GROUP BY product_id
    )
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.rating,
      p.review_count as "reviewCount",
      COALESCE(pvc.view_count, 0)::int as "viewCount",
      p.release_date::text as "releaseDate",
      p.ai_short_description as "aiDescription",
      COALESCE(
        (SELECT array_agg(pf.name ORDER BY pf.name) FROM product_performers pp
         INNER JOIN performers pf ON pp.performer_id = pf.id
         WHERE pp.product_id = p.id),
        ARRAY[]::text[]
      ) as performers,
      COALESCE(
        (SELECT array_agg(t.name ORDER BY t.name) FROM product_tags pt
         INNER JOIN tags t ON pt.tag_id = t.id
         WHERE pt.product_id = p.id AND t.category = 'genre'),
        ARRAY[]::text[]
      ) as genres
    FROM products p
    LEFT JOIN product_views_count pvc ON p.id = pvc.product_id
    WHERE p.rating >= 4.0
      AND p.review_count >= 5
      AND p.release_date < CURRENT_DATE - INTERVAL '1 year'
    ORDER BY p.rating DESC, p.review_count DESC
    LIMIT 10
  `);

  // レビューが熱い隠れた作品
  const sleepersWithReviewsResult = await db.execute(sql`
    WITH product_views_count AS (
      SELECT product_id, COUNT(*) as view_count
      FROM product_views
      GROUP BY product_id
    ),
    review_activity AS (
      SELECT
        product_id,
        COUNT(*) as review_count,
        MAX(created_at) as last_review_at
      FROM product_reviews
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY product_id
    )
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.rating,
      p.review_count as "reviewCount",
      COALESCE(pvc.view_count, 0)::int as "viewCount",
      p.release_date::text as "releaseDate",
      p.ai_short_description as "aiDescription",
      COALESCE(
        (SELECT array_agg(pf.name ORDER BY pf.name) FROM product_performers pp
         INNER JOIN performers pf ON pp.performer_id = pf.id
         WHERE pp.product_id = p.id),
        ARRAY[]::text[]
      ) as performers,
      COALESCE(
        (SELECT array_agg(t.name ORDER BY t.name) FROM product_tags pt
         INNER JOIN tags t ON pt.tag_id = t.id
         WHERE pt.product_id = p.id AND t.category = 'genre'),
        ARRAY[]::text[]
      ) as genres
    FROM products p
    INNER JOIN review_activity ra ON p.id = ra.product_id
    LEFT JOIN product_views_count pvc ON p.id = pvc.product_id
    WHERE p.rating >= 3.5
      AND p.release_date < CURRENT_DATE - INTERVAL '6 months'
    ORDER BY ra.review_count DESC, p.rating DESC
    LIMIT 10
  `);

  // 最近発見された名作（最近視聴数が増えている古い作品）
  const recentDiscoveriesResult = await db.execute(sql`
    WITH recent_views AS (
      SELECT product_id, COUNT(*) as recent_count
      FROM product_views
      WHERE viewed_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY product_id
    ),
    older_views AS (
      SELECT product_id, COUNT(*) as older_count
      FROM product_views
      WHERE viewed_at >= CURRENT_DATE - INTERVAL '30 days'
        AND viewed_at < CURRENT_DATE - INTERVAL '7 days'
      GROUP BY product_id
    )
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url as "imageUrl",
      p.rating,
      p.review_count as "reviewCount",
      COALESCE(rv.recent_count, 0)::int as "viewCount",
      p.release_date::text as "releaseDate",
      p.ai_short_description as "aiDescription",
      COALESCE(
        (SELECT array_agg(pf.name ORDER BY pf.name) FROM product_performers pp
         INNER JOIN performers pf ON pp.performer_id = pf.id
         WHERE pp.product_id = p.id),
        ARRAY[]::text[]
      ) as performers,
      COALESCE(
        (SELECT array_agg(t.name ORDER BY t.name) FROM product_tags pt
         INNER JOIN tags t ON pt.tag_id = t.id
         WHERE pt.product_id = p.id AND t.category = 'genre'),
        ARRAY[]::text[]
      ) as genres
    FROM products p
    INNER JOIN recent_views rv ON p.id = rv.product_id
    LEFT JOIN older_views ov ON p.id = ov.product_id
    WHERE p.release_date < CURRENT_DATE - INTERVAL '3 months'
      AND p.rating >= 3.5
      AND COALESCE(rv.recent_count, 0) > COALESCE(ov.older_count, 0) * 2
    ORDER BY (COALESCE(rv.recent_count, 0) - COALESCE(ov.older_count, 0)) DESC
    LIMIT 10
  `);

  // 統計
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      AVG(rating)::float as avg_rating,
      AVG(COALESCE(sub.view_count, 0))::float as avg_views
    FROM products p
    LEFT JOIN (
      SELECT product_id, COUNT(*) as view_count
      FROM product_views
      GROUP BY product_id
    ) sub ON p.id = sub.product_id
    WHERE p.rating >= 4.0 AND p.review_count >= 3
  `);

  const whyHiddenReasons = {
    ja: [
      '高評価だが視聴数が少ない',
      '1年以上前の隠れた名作',
      '最近レビューが増加中',
      '最近再発見された作品',
    ],
    en: [
      'High rated but few views',
      'Classic underrated gem',
      'Recent review surge',
      'Recently rediscovered',
    ],
  };

  const reasons = whyHiddenReasons[locale as keyof typeof whyHiddenReasons] || whyHiddenReasons.ja;

  const mapGem = (row: Record<string, unknown>, reason: string): HiddenGem => ({
    id: row.id as number,
    title: row.title as string,
    imageUrl: row.imageUrl as string | null,
    rating: Number(row.rating),
    reviewCount: Number(row.reviewCount),
    viewCount: Number(row.viewCount),
    releaseDate: row.releaseDate as string,
    performers: (row.performers as string[]) || [],
    genres: (row.genres as string[]) || [],
    aiDescription: row.aiDescription as string | null,
    whyHidden: reason,
  });

  const stats = statsResult.rows[0] as { total: number; avg_rating: number; avg_views: number };

  return {
    highRatedLowViews: (highRatedLowViewsResult.rows as Array<Record<string, unknown>>).map(row => mapGem(row, reasons[0])),
    underratedClassics: (underratedClassicsResult.rows as Array<Record<string, unknown>>).map(row => mapGem(row, reasons[1])),
    sleepersWithReviews: (sleepersWithReviewsResult.rows as Array<Record<string, unknown>>).map(row => mapGem(row, reasons[2])),
    recentDiscoveries: (recentDiscoveriesResult.rows as Array<Record<string, unknown>>).map(row => mapGem(row, reasons[3])),
    stats: {
      totalHiddenGems: stats?.total || 0,
      avgRating: stats?.avg_rating || 0,
      avgViews: stats?.avg_views || 0,
    },
  };
}

const translations = {
  ja: {
    title: '隠れた名作発掘',
    subtitle: 'AIが発掘した見逃している高評価作品',
    highRatedLowViews: '高評価だが見過ごされがちな作品',
    underratedClassics: '時を超えて愛される名作',
    sleepersWithReviews: '最近話題になり始めた作品',
    recentDiscoveries: '今週再発見された作品',
    rating: '評価',
    reviews: 'レビュー',
    views: '視聴',
    released: '発売',
    whyGem: 'おすすめ理由',
    totalGems: '隠れた名作数',
    avgRating: '平均評価',
    discoverMore: 'もっと見る',
    noData: 'データがありません',
  },
  en: {
    title: 'Hidden Gems Discovery',
    subtitle: 'AI-curated high-rated works you might have missed',
    highRatedLowViews: 'High-Rated But Overlooked',
    underratedClassics: 'Timeless Underrated Classics',
    sleepersWithReviews: 'Recently Gaining Attention',
    recentDiscoveries: 'Rediscovered This Week',
    rating: 'Rating',
    reviews: 'reviews',
    views: 'views',
    released: 'Released',
    whyGem: 'Why it\'s a gem',
    totalGems: 'Hidden Gems',
    avgRating: 'Avg Rating',
    discoverMore: 'Discover More',
    noData: 'No data available',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(
    t.title,
    t.subtitle,
    undefined,
    '/hidden-gems',
    undefined,
    locale,
  );
}

export default async function HiddenGemsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations('nav');
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const data = await getHiddenGemsData(locale);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.subtitle,
  };

  function GemCard({ gem }: { gem: HiddenGem }) {
    return (
      <Link
        href={localizedHref(`/products/${gem.id}`, locale)}
        className="group theme-card rounded-lg overflow-hidden hover:ring-2 hover:ring-yellow-500/50 transition-all"
      >
        <div className="relative">
          <div className="aspect-[2/3] bg-gray-700 overflow-hidden">
            {gem.imageUrl ? (
              <img
                src={gem.imageUrl}
                alt={gem.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No Image
              </div>
            )}
          </div>
          <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Gem className="w-3 h-3" />
            <span>GEM</span>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{gem.rating.toFixed(1)}</span>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold theme-text group-hover:text-yellow-400 transition-colors line-clamp-2 mb-2">
            {gem.title}
          </h3>
          {gem.performers.length > 0 && (
            <p className="text-sm theme-text-muted line-clamp-1 mb-2">
              {gem.performers.slice(0, 3).join(', ')}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs theme-text-muted mb-2">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {gem.reviewCount}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {gem.viewCount}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {gem.genres.slice(0, 2).map(genre => (
              <span key={genre} className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-300">
                {genre}
              </span>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-700">
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <ThumbsUp className="w-3 h-3" />
              <span>{gem.whyHidden}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  function Section({ title, icon, gems }: { title: string; icon: React.ReactNode; gems: HiddenGem[] }) {
    if (gems.length === 0) return null;
    return (
      <section className="mb-12">
        <h2 className="text-xl font-bold theme-text mb-6 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {gems.map(gem => (
            <GemCard key={gem.id} gem={gem} />
          ))}
        </div>
      </section>
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
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-4 py-2 rounded-full mb-4">
              <Gem className="w-5 h-5" />
              <span className="font-bold">HIDDEN GEMS</span>
            </div>
            <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="theme-card rounded-lg p-6 text-center">
              <Gem className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-3xl font-bold theme-text">{data.stats.totalHiddenGems}</div>
              <div className="text-sm theme-text-muted">{t.totalGems}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-3xl font-bold theme-text">{data.stats.avgRating.toFixed(1)}</div>
              <div className="text-sm theme-text-muted">{t.avgRating}</div>
            </div>
          </div>

          {/* 各セクション */}
          <Section
            title={t.highRatedLowViews}
            icon={<EyeOff className="w-5 h-5 text-blue-400" />}
            gems={data.highRatedLowViews}
          />

          <Section
            title={t.underratedClassics}
            icon={<Sparkles className="w-5 h-5 text-purple-400" />}
            gems={data.underratedClassics}
          />

          <Section
            title={t.sleepersWithReviews}
            icon={<MessageCircle className="w-5 h-5 text-green-400" />}
            gems={data.sleepersWithReviews}
          />

          <Section
            title={t.recentDiscoveries}
            icon={<TrendingUp className="w-5 h-5 text-rose-400" />}
            gems={data.recentDiscoveries}
          />

          {/* データがない場合 */}
          {data.highRatedLowViews.length === 0 &&
           data.underratedClassics.length === 0 &&
           data.sleepersWithReviews.length === 0 &&
           data.recentDiscoveries.length === 0 && (
            <div className="theme-card rounded-lg p-8 text-center theme-text-muted">
              {t.noData}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
