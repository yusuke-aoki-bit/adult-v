import { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Sparkles, Calendar, TrendingUp, Star, Clock, ExternalLink } from 'lucide-react';

// force-dynamic: next-intlのgetTranslationsがheaders()を内部呼出しするためISR不可
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

const metaTranslations = {
  ja: {
    title: '今日の1本',
    description: '毎日更新！AIが選ぶ今日のおすすめAV作品。季節・トレンド・人気度を考慮した厳選作品をお届け。',
    keywords: ['今日のおすすめ', 'AV', '厳選', 'デイリーピック', 'おすすめ作品'],
    ogDescription: 'AIが選ぶ今日のおすすめ作品',
  },
  en: {
    title: 'Daily Pick',
    description:
      "Updated daily! Today's recommended AV work selected by AI. Curated picks considering season, trends, and popularity.",
    keywords: ['daily pick', 'AV', 'recommended', 'curated', 'best selection'],
    ogDescription: "Today's AI-selected recommendation",
  },
} as const;

function getMetaT(locale: string) {
  return metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const mt = getMetaT(locale);
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  return {
    title: `${mt.title} - ${dateStr}`,
    description: mt.description,
    keywords: mt.keywords as unknown as string[],
    robots: { index: false, follow: true },
    openGraph: {
      title: `${mt.title} - ${dateStr}`,
      description: mt.ogDescription,
    },
  };
}

const translations = {
  ja: {
    title: '今日の1本',
    subtitle: 'AIが選ぶ本日のおすすめ作品',
    todaysPick: '本日のピックアップ',
    whySelected: '選出理由',
    releaseDate: '発売日',
    duration: '収録時間',
    min: '分',
    performers: '出演者',
    tags: 'ジャンル',
    viewDetails: '詳細を見る',
    buyNow: '購入する',
    previousPicks: '過去のピックアップ',
    yesterday: '昨日',
    twoDaysAgo: '2日前',
    threeDaysAgo: '3日前',
    refreshTime: '毎日0時に更新',
    noPickAvailable: '本日のおすすめ作品を準備中です',
    noPickDescription: 'しばらくお待ちください。',
    highlyRated: '高評価作品',
    manyReviews: 'レビュー多数',
    trending: '人気急上昇',
    starStuddedCast: '豪華共演',
    aiRecommended: 'AIおすすめ',
    prNotice: '当ページには広告・アフィリエイトリンクが含まれています',
  },
  en: {
    title: 'Daily Pick',
    subtitle: "Today's AI-selected recommendation",
    todaysPick: "Today's Pick",
    whySelected: 'Why Selected',
    releaseDate: 'Release Date',
    duration: 'Duration',
    min: 'min',
    performers: 'Performers',
    tags: 'Genres',
    viewDetails: 'View Details',
    buyNow: 'Buy Now',
    previousPicks: 'Previous Picks',
    yesterday: 'Yesterday',
    twoDaysAgo: '2 days ago',
    threeDaysAgo: '3 days ago',
    refreshTime: 'Updates daily at midnight',
    noPickAvailable: "Preparing today's recommendation",
    noPickDescription: 'Please wait a moment.',
    highlyRated: 'Highly rated',
    manyReviews: 'Many reviews',
    trending: 'Trending',
    starStuddedCast: 'Star-studded cast',
    aiRecommended: 'AI Recommended',
    prNotice: 'This page contains advertisements and affiliate links',
  },
};

interface DailyProduct {
  id: number;
  normalized_product_id: string;
  title: string;
  release_date: string | null;
  default_thumbnail_url: string | null;
  duration: number | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number;
  view_count: number;
  min_price: number | null;
  performers: Array<{ id: number; name: string }> | null;
  tags: Array<{ id: number; name: string }> | null;
}

// 日付ベースの疑似乱数生成（同じ日なら同じ結果）
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default async function DailyPickPage({ params }: Props) {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const db = getDb();

  const today = new Date();
  const todaySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  // 今日のピック：高評価・人気作品から日付ベースで選択
  // 季節要素: 月によってジャンル傾向を変える
  const month = today.getMonth() + 1;
  const _seasonalBoost =
    month >= 6 && month <= 8
      ? 'ビキニ,水着,プール'
      : month === 12 || month <= 2
        ? 'コタツ,温泉,鍋'
        : month >= 3 && month <= 5
          ? '新生活,入学,制服'
          : '';

  // product_viewsテーブルが存在しない場合も動作するようにする
  // エラー時はフォールバッククエリを実行、それでも失敗したら空の結果
  let todayPickResult: { rows: unknown[] } = { rows: [] };
  try {
    todayPickResult = await db.execute(sql`
      WITH product_view_counts AS (
        SELECT product_id, COUNT(*) as view_count
        FROM product_views
        GROUP BY product_id
      ),
      ranked_products AS (
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          p.release_date,
          p.default_thumbnail_url,
          p.duration,
          p.description,
          COALESCE(AVG(pr.rating), 0) as avg_rating,
          COUNT(DISTINCT pr.id) as review_count,
          COALESCE(pvc.view_count, 0) as view_count,
          (
            SELECT MIN(pp.price)
            FROM product_prices pp
            JOIN product_sources ps ON pp.source_id = ps.id
            WHERE ps.product_id = p.id AND pp.price > 0
          ) as min_price,
          (
            SELECT json_agg(json_build_object('id', pe.id, 'name', pe.name))
            FROM product_performers ppr
            JOIN performers pe ON ppr.performer_id = pe.id
            WHERE ppr.product_id = p.id
            LIMIT 5
          ) as performers,
          (
            SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
            FROM product_tags pt
            JOIN tags t ON pt.tag_id = t.id
            WHERE pt.product_id = p.id
            LIMIT 8
          ) as tags,
          -- スコア計算: 評価 + レビュー数 + 閲覧数 + 発売日の新しさ
          (
            COALESCE(AVG(pr.rating), 3) * 20 +
            LEAST(COUNT(DISTINCT pr.id), 50) * 2 +
            LEAST(COALESCE(pvc.view_count, 0) / 100, 50) +
            CASE WHEN p.release_date > CURRENT_DATE - INTERVAL '180 days' THEN 30 ELSE 0 END
          ) as score
        FROM products p
        LEFT JOIN product_reviews pr ON p.id = pr.product_id
        LEFT JOIN product_view_counts pvc ON p.id = pvc.product_id
        WHERE p.default_thumbnail_url IS NOT NULL
          AND p.release_date IS NOT NULL
          AND p.release_date <= CURRENT_DATE
        GROUP BY p.id, pvc.view_count
        -- レビュー3件以上、閲覧数100以上、または発売日が過去1年以内の作品を対象
        HAVING COUNT(DISTINCT pr.id) >= 3 OR COALESCE(pvc.view_count, 0) >= 100 OR p.release_date > CURRENT_DATE - INTERVAL '365 days'
        ORDER BY score DESC
        LIMIT 100
      )
      SELECT *
      FROM ranked_products
      OFFSET ${Math.floor(seededRandom(todaySeed) * 50)}
      LIMIT 1
    `);
  } catch (primaryError) {
    console.error('[daily-pick] Primary query failed:', primaryError);
    try {
      // product_viewsテーブルが存在しない場合はview_countなしでクエリ
      todayPickResult = await db.execute(sql`
      WITH ranked_products AS (
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          p.release_date,
          p.default_thumbnail_url,
          p.duration,
          p.description,
          COALESCE(AVG(pr.rating), 0) as avg_rating,
          COUNT(DISTINCT pr.id) as review_count,
          0 as view_count,
          (
            SELECT MIN(pp.price)
            FROM product_prices pp
            JOIN product_sources ps ON pp.source_id = ps.id
            WHERE ps.product_id = p.id AND pp.price > 0
          ) as min_price,
          (
            SELECT json_agg(json_build_object('id', pe.id, 'name', pe.name))
            FROM product_performers ppr
            JOIN performers pe ON ppr.performer_id = pe.id
            WHERE ppr.product_id = p.id
            LIMIT 5
          ) as performers,
          (
            SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
            FROM product_tags pt
            JOIN tags t ON pt.tag_id = t.id
            WHERE pt.product_id = p.id
            LIMIT 8
          ) as tags,
          (
            COALESCE(AVG(pr.rating), 3) * 20 +
            LEAST(COUNT(DISTINCT pr.id), 50) * 2 +
            CASE WHEN p.release_date > CURRENT_DATE - INTERVAL '180 days' THEN 30 ELSE 0 END
          ) as score
        FROM products p
        LEFT JOIN product_reviews pr ON p.id = pr.product_id
        WHERE p.default_thumbnail_url IS NOT NULL
          AND p.release_date IS NOT NULL
          AND p.release_date <= CURRENT_DATE
        GROUP BY p.id
        -- レビューなしでもサムネイルがあれば対象に（条件緩和）
        ORDER BY score DESC
        LIMIT 100
      )
      SELECT *
      FROM ranked_products
      OFFSET ${Math.floor(seededRandom(todaySeed) * 50)}
      LIMIT 1
    `);
    } catch (fallbackError) {
      console.error('[daily-pick] Fallback query also failed:', fallbackError);
      // 空の結果のまま続行
    }
  }

  // 過去3日間のピック
  let previousPicksResult: { rows: unknown[] } = { rows: [] };
  try {
    previousPicksResult = await db.execute(sql`
      WITH product_view_counts AS (
        SELECT product_id, COUNT(*) as view_count
        FROM product_views
        GROUP BY product_id
      ),
      ranked_products AS (
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          p.default_thumbnail_url,
          (
            COALESCE(AVG(pr.rating), 3) * 20 +
            LEAST(COUNT(DISTINCT pr.id), 50) * 2 +
            LEAST(COALESCE(pvc.view_count, 0) / 100, 50)
          ) as score
        FROM products p
        LEFT JOIN product_reviews pr ON p.id = pr.product_id
        LEFT JOIN product_view_counts pvc ON p.id = pvc.product_id
        WHERE p.default_thumbnail_url IS NOT NULL
          AND p.release_date IS NOT NULL
        GROUP BY p.id, pvc.view_count
        ORDER BY score DESC
        LIMIT 100
      )
      SELECT * FROM (
        SELECT *, 1 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 1) * 50)} LIMIT 1
      ) d1
      UNION ALL
      SELECT * FROM (
        SELECT *, 2 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 2) * 50)} LIMIT 1
      ) d2
      UNION ALL
      SELECT * FROM (
        SELECT *, 3 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 3) * 50)} LIMIT 1
      ) d3
    `);
  } catch (primaryError) {
    console.error('[daily-pick] Previous picks primary query failed:', primaryError);
    try {
      // product_viewsテーブルが存在しない場合はview_countなしでクエリ
      previousPicksResult = await db.execute(sql`
        WITH ranked_products AS (
          SELECT
            p.id,
            p.normalized_product_id,
            p.title,
            p.default_thumbnail_url,
            (
              COALESCE(AVG(pr.rating), 3) * 20 +
              LEAST(COUNT(DISTINCT pr.id), 50) * 2
            ) as score
          FROM products p
          LEFT JOIN product_reviews pr ON p.id = pr.product_id
          WHERE p.default_thumbnail_url IS NOT NULL
          GROUP BY p.id
          ORDER BY score DESC
          LIMIT 100
        )
        SELECT * FROM (
          SELECT *, 1 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 1) * 50)} LIMIT 1
        ) d1
        UNION ALL
        SELECT * FROM (
          SELECT *, 2 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 2) * 50)} LIMIT 1
        ) d2
        UNION ALL
        SELECT * FROM (
          SELECT *, 3 as day_offset FROM ranked_products OFFSET ${Math.floor(seededRandom(todaySeed - 3) * 50)} LIMIT 1
        ) d3
      `);
    } catch (fallbackError) {
      console.error('[daily-pick] Previous picks fallback query also failed:', fallbackError);
      // 空の結果のまま続行
    }
  }

  const todayPick = todayPickResult.rows[0] as unknown as DailyProduct | undefined;
  const previousPicks = previousPicksResult.rows as Array<{
    id: number;
    normalized_product_id: string;
    title: string;
    default_thumbnail_url: string | null;
    day_offset: number;
  }>;

  const dayLabels = [t.yesterday, t.twoDaysAgo, t.threeDaysAgo];

  // 選出理由を生成
  const generateReason = (product: DailyProduct | undefined): string => {
    if (!product) return '';
    const reasons: string[] = [];

    if (product.avg_rating && Number(product.avg_rating) >= 4) {
      reasons.push(t.highlyRated);
    }
    if (product.review_count >= 10) {
      reasons.push(t.manyReviews);
    }
    if (product.view_count >= 1000) {
      reasons.push(t.trending);
    }
    if (product.performers && product.performers.length >= 2) {
      reasons.push(t.starStuddedCast);
    }

    return reasons.length > 0 ? reasons.join(' / ') : t.aiRecommended;
  };

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* PR表記 */}
        <p className="mb-4 text-center text-xs text-gray-400">
          <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
          {t.prNotice}
        </p>

        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            <span className="font-medium text-yellow-300">
              {today.getFullYear()}/{today.getMonth() + 1}/{today.getDate()}
            </span>
          </div>
          <h1 className="theme-text mb-2 text-3xl font-bold">{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {t.refreshTime}
          </p>
        </div>

        {/* 今日のピック */}
        {todayPick ? (
          <section className="mb-10">
            <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
              <Star className="h-6 w-6 text-yellow-400" />
              {t.todaysPick}
            </h2>
            <div className="theme-card overflow-hidden rounded-xl">
              <div className="md:flex">
                {/* サムネイル */}
                <div className="relative aspect-video md:aspect-auto md:w-1/2">
                  {todayPick.default_thumbnail_url ? (
                    <img
                      src={todayPick.default_thumbnail_url}
                      alt={todayPick.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-gray-800 text-gray-600">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-4 left-4 rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black">
                    TODAY&apos;S PICK
                  </div>
                </div>

                {/* 情報 */}
                <div className="p-6 md:w-1/2">
                  <h3 className="theme-text mb-3 line-clamp-2 text-xl font-bold">{todayPick.title}</h3>

                  {/* 選出理由 */}
                  <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="text-sm text-yellow-300">
                      <span className="font-medium">{t.whySelected}:</span> {generateReason(todayPick)}
                    </p>
                  </div>

                  {/* メタ情報 */}
                  <div className="theme-text-muted mb-4 space-y-2 text-sm">
                    {todayPick.release_date && (
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t.releaseDate}: {todayPick.release_date}
                      </p>
                    )}
                    {todayPick.duration && (
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {t.duration}: {todayPick.duration}
                        {t.min}
                      </p>
                    )}
                  </div>

                  {/* 出演者 */}
                  {todayPick.performers && todayPick.performers.length > 0 && (
                    <div className="mb-4">
                      <p className="theme-text-muted mb-1 text-xs">{t.performers}</p>
                      <div className="flex flex-wrap gap-1">
                        {todayPick.performers.map((p) => (
                          <Link
                            key={p.id}
                            href={localizedHref(`/actress/${p.id}`, locale)}
                            className="rounded bg-pink-500/20 px-2 py-0.5 text-sm text-pink-300 transition-colors hover:bg-pink-500/30"
                          >
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* タグ */}
                  {todayPick.tags && todayPick.tags.length > 0 && (
                    <div className="mb-4">
                      <p className="theme-text-muted mb-1 text-xs">{t.tags}</p>
                      <div className="flex flex-wrap gap-1">
                        {todayPick.tags.slice(0, 6).map((tag) => (
                          <span key={tag.id} className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 価格・ボタン */}
                  <div className="mt-4 flex items-center gap-3">
                    {todayPick.min_price && (
                      <span className="text-xl font-bold text-pink-400">
                        ¥{Number(todayPick.min_price).toLocaleString()}〜
                      </span>
                    )}
                    <Link
                      href={localizedHref(`/products/${todayPick.normalized_product_id}`, locale)}
                      className="flex items-center gap-1 rounded-lg bg-pink-600 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-500"
                    >
                      {t.viewDetails}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-10">
            <div className="theme-card overflow-hidden rounded-xl p-8 text-center">
              <Sparkles className="mx-auto mb-4 h-12 w-12 text-yellow-400" />
              <h2 className="theme-text mb-2 text-xl font-bold">{t.noPickAvailable}</h2>
              <p className="theme-text-muted">{t.noPickDescription}</p>
            </div>
          </section>
        )}

        {/* 過去のピック */}
        {previousPicks.length > 0 && (
          <section>
            <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
              <TrendingUp className="h-6 w-6 text-blue-400" />
              {t.previousPicks}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {previousPicks.map((pick, idx) => (
                <Link
                  key={pick.id}
                  href={localizedHref(`/products/${pick.normalized_product_id}`, locale)}
                  className="theme-card block overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-blue-500/50"
                >
                  <div className="relative aspect-video bg-gray-800">
                    {pick.default_thumbnail_url ? (
                      <img
                        src={pick.default_thumbnail_url}
                        alt={pick.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-600">No Image</div>
                    )}
                    <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-gray-300">
                      {dayLabels[idx]}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="theme-text line-clamp-2 text-sm font-medium">{pick.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
