import { Metadata } from 'next';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Star, Trophy, MessageCircle, TrendingUp, Crown, Medal, Award, ThumbsUp, Calendar } from 'lucide-react';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

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

  // user_reviewsテーブルが存在するか確認（マイグレーション未適用の場合エラー回避）
  try {
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user_reviews'
      ) as exists
    `);
    const tableExists = (tableCheck.rows[0] as { exists: boolean })?.exists;
    if (!tableExists) {
      // テーブルが存在しない場合は空のデータを返す
      return {
        topReviewers: [],
        monthlyTopReviewers: [],
        mostHelpful: [],
        stats: { totalReviewers: 0, totalReviews: 0, avgReviewsPerUser: 0 },
      };
    }
  } catch {
    // エラー時も空のデータを返す
    return {
      topReviewers: [],
      monthlyTopReviewers: [],
      mostHelpful: [],
      stats: { totalReviewers: 0, totalReviews: 0, avgReviewsPerUser: 0 },
    };
  }

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
    monthlyTopReviewers: (monthlyTopResult.rows as Array<Record<string, unknown>>).map((row, i) =>
      mapReviewer(row, i + 1),
    ),
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

  return generateBaseMetadata(t.title, t.subtitle, undefined, '/reviewers', undefined, locale);
}

export default async function ReviewersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const data = await getReviewersData();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.subtitle,
  };

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-300" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="flex h-6 w-6 items-center justify-center font-bold text-gray-500">#{rank}</span>;
  }

  function getRankBg(rank: number) {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-900/50 to-amber-900/30 border-yellow-500/50';
    if (rank === 2) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-gray-400/50';
    if (rank === 3) return 'bg-gradient-to-r from-amber-900/50 to-orange-900/30 border-amber-600/50';
    return 'bg-gray-800/30 border-gray-700';
  }

  function ReviewerCard({ reviewer }: { reviewer: TopReviewer }) {
    return (
      <div className={`theme-card rounded-lg border p-4 ${getRankBg(reviewer.rank)}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">{getRankIcon(reviewer.rank)}</div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="theme-text truncate font-bold">{reviewer.displayName}</h3>
              {reviewer.recentActivity > 0 && (
                <span className="rounded bg-green-600/30 px-2 py-0.5 text-xs text-green-400">Active</span>
              )}
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
              <div className="theme-text-muted flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>
                  {reviewer.reviewCount} {t.reviews}
                </span>
              </div>
              <div className="theme-text-muted flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{reviewer.avgRating.toFixed(1)}</span>
              </div>
              <div className="theme-text-muted flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{reviewer.helpfulVotes}</span>
              </div>
            </div>
            {reviewer.favoriteGenres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reviewer.favoriteGenres.slice(0, 3).map((genre) => (
                  <span key={genre} className="rounded bg-gray-700/50 px-2 py-0.5 text-xs text-gray-300">
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
      <div className="flex items-center gap-3 rounded-lg bg-gray-800/30 p-3">
        <div className="w-8 flex-shrink-0 text-center">
          {reviewer.rank <= 3 ? (
            getRankIcon(reviewer.rank)
          ) : (
            <span className="font-bold text-gray-500">#{reviewer.rank}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="theme-text truncate font-medium">{reviewer.displayName}</div>
          <div className="theme-text-muted flex items-center gap-3 text-xs">
            <span>
              {reviewer.reviewCount} {t.reviews}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-white">
              <Trophy className="h-5 w-5" />
              <span className="font-bold">REVIEWER RANKINGS</span>
            </div>
            <h1 className="theme-text mb-2 text-3xl font-bold">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
          </div>

          {/* 統計カード */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="theme-card rounded-lg p-6 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-blue-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.totalReviewers}</div>
              <div className="theme-text-muted text-sm">{t.totalReviewers}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-yellow-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.totalReviews}</div>
              <div className="theme-text-muted text-sm">{t.totalReviews}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-green-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.avgReviewsPerUser.toFixed(1)}</div>
              <div className="theme-text-muted text-sm">{t.avgPerUser}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* トップレビュアー */}
            <div className="lg:col-span-2">
              <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
                <Trophy className="h-5 w-5 text-yellow-400" />
                {t.topReviewers}
              </h2>
              {data.topReviewers.length > 0 ? (
                <div className="space-y-3">
                  {data.topReviewers.slice(0, 10).map((reviewer) => (
                    <ReviewerCard key={reviewer.userId} reviewer={reviewer} />
                  ))}
                </div>
              ) : (
                <div className="theme-card theme-text-muted rounded-lg p-8 text-center">{t.noData}</div>
              )}
            </div>

            {/* サイドバー */}
            <div className="space-y-8">
              {/* 今月のアクティブ */}
              <div>
                <h2 className="theme-text mb-4 flex items-center gap-2 text-lg font-bold">
                  <Calendar className="h-5 w-5 text-green-400" />
                  {t.monthlyTop}
                </h2>
                {data.monthlyTopReviewers.length > 0 ? (
                  <div className="space-y-2">
                    {data.monthlyTopReviewers.slice(0, 5).map((reviewer) => (
                      <CompactReviewerCard key={reviewer.userId} reviewer={reviewer} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card theme-text-muted rounded-lg p-4 text-center text-sm">{t.noData}</div>
                )}
              </div>

              {/* 最も参考になった */}
              <div>
                <h2 className="theme-text mb-4 flex items-center gap-2 text-lg font-bold">
                  <Award className="h-5 w-5 text-purple-400" />
                  {t.mostHelpful}
                </h2>
                {data.mostHelpful.length > 0 ? (
                  <div className="space-y-2">
                    {data.mostHelpful.slice(0, 5).map((reviewer) => (
                      <CompactReviewerCard key={reviewer.userId} reviewer={reviewer} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card theme-text-muted rounded-lg p-4 text-center text-sm">{t.noData}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
