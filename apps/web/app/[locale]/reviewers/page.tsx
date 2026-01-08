import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Star, Trophy, MessageCircle, TrendingUp, Crown, Medal, Award, ThumbsUp, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface TopReviewer {
  rank: number;
  userId: string;
  displayName: string;
  reviewCount: number;
  avgRating: number;
  helpfulVotes: number;
  latestReviewDate: string | null;
  favoriteGenres: string[];
  recentActivity: number;
}

interface ReviewersData {
  topReviewers: TopReviewer[];
  monthlyTopReviewers: TopReviewer[];
  mostHelpful: TopReviewer[];
  stats: {
    totalReviewers: number;
    totalReviews: number;
    avgReviewsPerUser: number;
  };
}

async function getReviewersData(): Promise<ReviewersData> {
  const db = getDb();

  // トップレビュアー（全期間）
  const topReviewersResult = await db.execute(sql`
    WITH reviewer_stats AS (
      SELECT
        user_id,
        COUNT(*) as review_count,
        AVG(rating::float) as avg_rating,
        COALESCE(SUM(helpful_count), 0) as helpful_votes,
        MAX(created_at) as latest_review_date,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_activity
      FROM user_reviews
      WHERE status = 'approved'
      GROUP BY user_id
      HAVING COUNT(*) >= 3
    ),
    reviewer_genres AS (
      SELECT
        ur.user_id,
        array_agg(DISTINCT t.name ORDER BY COUNT(*) DESC) FILTER (WHERE t.name IS NOT NULL) as genres
      FROM user_reviews ur
      INNER JOIN product_tags pt ON ur.product_id = pt.product_id
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE t.category = 'genre' AND ur.status = 'approved'
      GROUP BY ur.user_id
    )
    SELECT
      rs.user_id as "userId",
      COALESCE(
        (SELECT display_name FROM user_profiles WHERE user_id = rs.user_id LIMIT 1),
        CONCAT('User_', LEFT(rs.user_id, 8))
      ) as "displayName",
      rs.review_count::int as "reviewCount",
      rs.avg_rating::float as "avgRating",
      rs.helpful_votes::int as "helpfulVotes",
      rs.latest_review_date::text as "latestReviewDate",
      COALESCE(rg.genres[1:5], ARRAY[]::text[]) as "favoriteGenres",
      rs.recent_activity::int as "recentActivity"
    FROM reviewer_stats rs
    LEFT JOIN reviewer_genres rg ON rs.user_id = rg.user_id
    ORDER BY rs.review_count DESC, rs.helpful_votes DESC
    LIMIT 20
  `);

  // 今月のトップレビュアー
  const monthlyTopResult = await db.execute(sql`
    WITH monthly_stats AS (
      SELECT
        user_id,
        COUNT(*) as review_count,
        AVG(rating::float) as avg_rating,
        COALESCE(SUM(helpful_count), 0) as helpful_votes,
        MAX(created_at) as latest_review_date
      FROM user_reviews
      WHERE status = 'approved'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY user_id
    )
    SELECT
      ms.user_id as "userId",
      COALESCE(
        (SELECT display_name FROM user_profiles WHERE user_id = ms.user_id LIMIT 1),
        CONCAT('User_', LEFT(ms.user_id, 8))
      ) as "displayName",
      ms.review_count::int as "reviewCount",
      ms.avg_rating::float as "avgRating",
      ms.helpful_votes::int as "helpfulVotes",
      ms.latest_review_date::text as "latestReviewDate",
      ARRAY[]::text[] as "favoriteGenres",
      ms.review_count::int as "recentActivity"
    FROM monthly_stats ms
    ORDER BY ms.review_count DESC, ms.helpful_votes DESC
    LIMIT 10
  `);

  // 最も参考になったレビュアー
  const mostHelpfulResult = await db.execute(sql`
    WITH helpful_stats AS (
      SELECT
        user_id,
        COUNT(*) as review_count,
        AVG(rating::float) as avg_rating,
        COALESCE(SUM(helpful_count), 0) as helpful_votes,
        MAX(created_at) as latest_review_date
      FROM user_reviews
      WHERE status = 'approved'
        AND helpful_count > 0
      GROUP BY user_id
      HAVING SUM(helpful_count) >= 5
    )
    SELECT
      hs.user_id as "userId",
      COALESCE(
        (SELECT display_name FROM user_profiles WHERE user_id = hs.user_id LIMIT 1),
        CONCAT('User_', LEFT(hs.user_id, 8))
      ) as "displayName",
      hs.review_count::int as "reviewCount",
      hs.avg_rating::float as "avgRating",
      hs.helpful_votes::int as "helpfulVotes",
      hs.latest_review_date::text as "latestReviewDate",
      ARRAY[]::text[] as "favoriteGenres",
      0 as "recentActivity"
    FROM helpful_stats hs
    ORDER BY hs.helpful_votes DESC, hs.review_count DESC
    LIMIT 10
  `);

  // 統計
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id)::int as total_reviewers,
      COUNT(*)::int as total_reviews,
      (COUNT(*)::float / NULLIF(COUNT(DISTINCT user_id), 0))::float as avg_per_user
    FROM user_reviews
    WHERE status = 'approved'
  `);

  const mapReviewer = (row: Record<string, unknown>, rank: number): TopReviewer => ({
    rank,
    userId: row.userId as string,
    displayName: row.displayName as string,
    reviewCount: Number(row.reviewCount),
    avgRating: Number(row.avgRating),
    helpfulVotes: Number(row.helpfulVotes),
    latestReviewDate: row.latestReviewDate as string | null,
    favoriteGenres: (row.favoriteGenres as string[]) || [],
    recentActivity: Number(row.recentActivity),
  });

  const stats = statsResult.rows[0] as { total_reviewers: number; total_reviews: number; avg_per_user: number };

  return {
    topReviewers: (topReviewersResult.rows as Array<Record<string, unknown>>).map((row, i) => mapReviewer(row, i + 1)),
    monthlyTopReviewers: (monthlyTopResult.rows as Array<Record<string, unknown>>).map((row, i) => mapReviewer(row, i + 1)),
    mostHelpful: (mostHelpfulResult.rows as Array<Record<string, unknown>>).map((row, i) => mapReviewer(row, i + 1)),
    stats: {
      totalReviewers: stats?.total_reviewers || 0,
      totalReviews: stats?.total_reviews || 0,
      avgReviewsPerUser: stats?.avg_per_user || 0,
    },
  };
}

const translations = {
  ja: {
    title: 'レビュアーランキング',
    subtitle: '活発なレビュアーをランキング形式で紹介',
    topReviewers: 'トップレビュアー',
    monthlyTop: '今月のアクティブレビュアー',
    mostHelpful: '最も参考になったレビュアー',
    reviews: 'レビュー',
    avgRating: '平均評価',
    helpful: '参考になった',
    totalReviewers: '総レビュアー数',
    totalReviews: '総レビュー数',
    avgPerUser: '平均レビュー数/人',
    genres: 'よく書くジャンル',
    noData: 'データがありません',
    recentActivity: '今月の投稿',
  },
  en: {
    title: 'Reviewer Rankings',
    subtitle: 'Discover our most active and helpful reviewers',
    topReviewers: 'Top Reviewers',
    monthlyTop: 'Active This Month',
    mostHelpful: 'Most Helpful',
    reviews: 'reviews',
    avgRating: 'Avg Rating',
    helpful: 'helpful votes',
    totalReviewers: 'Total Reviewers',
    totalReviews: 'Total Reviews',
    avgPerUser: 'Avg Reviews/User',
    genres: 'Favorite Genres',
    noData: 'No data available',
    recentActivity: 'This month',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(
    t.title,
    t.subtitle,
    undefined,
    '/reviewers',
    undefined,
    locale,
  );
}

export default async function ReviewersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations('nav');
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const data = await getReviewersData();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.subtitle,
  };

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">#{rank}</span>;
  }

  function getRankBg(rank: number) {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-900/50 to-amber-900/30 border-yellow-500/50';
    if (rank === 2) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-gray-400/50';
    if (rank === 3) return 'bg-gradient-to-r from-amber-900/50 to-orange-900/30 border-amber-600/50';
    return 'bg-gray-800/30 border-gray-700';
  }

  function ReviewerCard({ reviewer }: { reviewer: TopReviewer }) {
    return (
      <div className={`theme-card rounded-lg p-4 border ${getRankBg(reviewer.rank)}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {getRankIcon(reviewer.rank)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold theme-text truncate">{reviewer.displayName}</h3>
              {reviewer.recentActivity > 0 && (
                <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div className="flex items-center gap-1 theme-text-muted">
                <MessageCircle className="w-4 h-4" />
                <span>{reviewer.reviewCount} {t.reviews}</span>
              </div>
              <div className="flex items-center gap-1 theme-text-muted">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{reviewer.avgRating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1 theme-text-muted">
                <ThumbsUp className="w-4 h-4" />
                <span>{reviewer.helpfulVotes}</span>
              </div>
            </div>
            {reviewer.favoriteGenres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reviewer.favoriteGenres.slice(0, 3).map(genre => (
                  <span key={genre} className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-300">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function CompactReviewerCard({ reviewer }: { reviewer: TopReviewer }) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
        <div className="flex-shrink-0 w-8 text-center">
          {reviewer.rank <= 3 ? getRankIcon(reviewer.rank) : (
            <span className="text-gray-500 font-bold">#{reviewer.rank}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium theme-text truncate">{reviewer.displayName}</div>
          <div className="flex items-center gap-3 text-xs theme-text-muted">
            <span>{reviewer.reviewCount} {t.reviews}</span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {reviewer.helpfulVotes}
            </span>
          </div>
        </div>
      </div>
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
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full mb-4">
              <Trophy className="w-5 h-5" />
              <span className="font-bold">REVIEWER RANKINGS</span>
            </div>
            <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="theme-card rounded-lg p-6 text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <div className="text-3xl font-bold theme-text">{data.stats.totalReviewers}</div>
              <div className="text-sm theme-text-muted">{t.totalReviewers}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-3xl font-bold theme-text">{data.stats.totalReviews}</div>
              <div className="text-sm theme-text-muted">{t.totalReviews}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="text-3xl font-bold theme-text">{data.stats.avgReviewsPerUser.toFixed(1)}</div>
              <div className="text-sm theme-text-muted">{t.avgPerUser}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* トップレビュアー */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                {t.topReviewers}
              </h2>
              {data.topReviewers.length > 0 ? (
                <div className="space-y-3">
                  {data.topReviewers.slice(0, 10).map(reviewer => (
                    <ReviewerCard key={reviewer.userId} reviewer={reviewer} />
                  ))}
                </div>
              ) : (
                <div className="theme-card rounded-lg p-8 text-center theme-text-muted">
                  {t.noData}
                </div>
              )}
            </div>

            {/* サイドバー */}
            <div className="space-y-8">
              {/* 今月のアクティブ */}
              <div>
                <h2 className="text-lg font-bold theme-text mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-400" />
                  {t.monthlyTop}
                </h2>
                {data.monthlyTopReviewers.length > 0 ? (
                  <div className="space-y-2">
                    {data.monthlyTopReviewers.slice(0, 5).map(reviewer => (
                      <CompactReviewerCard key={reviewer.userId} reviewer={reviewer} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card rounded-lg p-4 text-center theme-text-muted text-sm">
                    {t.noData}
                  </div>
                )}
              </div>

              {/* 最も参考になった */}
              <div>
                <h2 className="text-lg font-bold theme-text mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  {t.mostHelpful}
                </h2>
                {data.mostHelpful.length > 0 ? (
                  <div className="space-y-2">
                    {data.mostHelpful.slice(0, 5).map(reviewer => (
                      <CompactReviewerCard key={reviewer.userId} reviewer={reviewer} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card rounded-lg p-4 text-center theme-text-muted text-sm">
                    {t.noData}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
