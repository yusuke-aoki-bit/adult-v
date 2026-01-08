import { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Sparkles, Calendar, TrendingUp, Star, Clock, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isJa = locale === 'ja';
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  return {
    title: isJa ? `今日の1本 - ${dateStr}` : `Daily Pick - ${dateStr}`,
    description: isJa
      ? '毎日更新！AIが選ぶ今日のおすすめAV作品。季節・トレンド・人気度を考慮した厳選作品をお届け。'
      : "Updated daily! Today's recommended AV work selected by AI. Curated picks considering season, trends, and popularity.",
    keywords: isJa
      ? ['今日のおすすめ', 'AV', '厳選', 'デイリーピック', 'おすすめ作品']
      : ['daily pick', 'AV', 'recommended', 'curated', 'best selection'],
    openGraph: {
      title: isJa ? `今日の1本 - ${dateStr}` : `Daily Pick - ${dateStr}`,
      description: isJa ? 'AIが選ぶ今日のおすすめ作品' : "Today's AI-selected recommendation",
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
  const seasonalBoost = month >= 6 && month <= 8 ? 'ビキニ,水着,プール' :
                        month === 12 || month <= 2 ? 'コタツ,温泉,鍋' :
                        month >= 3 && month <= 5 ? '新生活,入学,制服' : '';

  const todayPickResult = await db.execute(sql`
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
        COUNT(pr.id) as review_count,
        COALESCE(SUM(pv.view_count), 0) as view_count,
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
          LEAST(COUNT(pr.id), 50) * 2 +
          LEAST(COALESCE(SUM(pv.view_count), 0) / 100, 50) +
          CASE WHEN p.release_date > CURRENT_DATE - INTERVAL '180 days' THEN 30 ELSE 0 END
        ) as score
      FROM products p
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      LEFT JOIN product_views pv ON p.id = pv.product_id
      WHERE p.default_thumbnail_url IS NOT NULL
        AND p.release_date IS NOT NULL
        AND p.release_date <= CURRENT_DATE
      GROUP BY p.id
      HAVING COUNT(pr.id) >= 3 OR COALESCE(SUM(pv.view_count), 0) >= 100
      ORDER BY score DESC
      LIMIT 100
    )
    SELECT *
    FROM ranked_products
    OFFSET ${Math.floor(seededRandom(todaySeed) * 50)}
    LIMIT 1
  `);

  // 過去3日間のピック
  const previousPicksResult = await db.execute(sql`
    WITH ranked_products AS (
      SELECT
        p.id,
        p.normalized_product_id,
        p.title,
        p.default_thumbnail_url,
        (
          COALESCE(AVG(pr.rating), 3) * 20 +
          LEAST(COUNT(pr.id), 50) * 2 +
          LEAST(COALESCE(SUM(pv.view_count), 0) / 100, 50)
        ) as score
      FROM products p
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      LEFT JOIN product_views pv ON p.id = pv.product_id
      WHERE p.default_thumbnail_url IS NOT NULL
      GROUP BY p.id
      HAVING COUNT(pr.id) >= 3 OR COALESCE(SUM(pv.view_count), 0) >= 100
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

  const todayPick = todayPickResult.rows[0] as DailyProduct | undefined;
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
      reasons.push(locale === 'ja' ? '高評価作品' : 'Highly rated');
    }
    if (product.review_count >= 10) {
      reasons.push(locale === 'ja' ? 'レビュー多数' : 'Many reviews');
    }
    if (product.view_count >= 1000) {
      reasons.push(locale === 'ja' ? '人気急上昇' : 'Trending');
    }
    if (product.performers && product.performers.length >= 2) {
      reasons.push(locale === 'ja' ? '豪華共演' : 'Star-studded cast');
    }

    return reasons.length > 0 ? reasons.join(' / ') : (locale === 'ja' ? 'AIおすすめ' : 'AI Recommended');
  };

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* PR表記 */}
        <p className="text-xs text-gray-400 mb-4 text-center">
          <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
          {locale === 'ja' ? '当ページには広告・アフィリエイトリンクが含まれています' : 'This page contains advertisements and affiliate links'}
        </p>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-300 font-medium">
              {today.getFullYear()}/{today.getMonth() + 1}/{today.getDate()}
            </span>
          </div>
          <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            {t.refreshTime}
          </p>
        </div>

        {/* 今日のピック */}
        {todayPick && (
          <section className="mb-10">
            <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              {t.todaysPick}
            </h2>
            <div className="rounded-xl overflow-hidden theme-card">
              <div className="md:flex">
                {/* サムネイル */}
                <div className="md:w-1/2 aspect-video md:aspect-auto relative">
                  {todayPick.default_thumbnail_url ? (
                    <img
                      src={todayPick.default_thumbnail_url}
                      alt={todayPick.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gray-800 text-gray-600">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-yellow-500 text-black text-sm font-bold">
                    TODAY&apos;S PICK
                  </div>
                </div>

                {/* 情報 */}
                <div className="md:w-1/2 p-6">
                  <h3 className="text-xl font-bold theme-text mb-3 line-clamp-2">
                    {todayPick.title}
                  </h3>

                  {/* 選出理由 */}
                  <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-sm text-yellow-300">
                      <span className="font-medium">{t.whySelected}:</span> {generateReason(todayPick)}
                    </p>
                  </div>

                  {/* メタ情報 */}
                  <div className="space-y-2 text-sm theme-text-muted mb-4">
                    {todayPick.release_date && (
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {t.releaseDate}: {todayPick.release_date}
                      </p>
                    )}
                    {todayPick.duration && (
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t.duration}: {todayPick.duration}{t.min}
                      </p>
                    )}
                  </div>

                  {/* 出演者 */}
                  {todayPick.performers && todayPick.performers.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs theme-text-muted mb-1">{t.performers}</p>
                      <div className="flex flex-wrap gap-1">
                        {todayPick.performers.map((p) => (
                          <Link
                            key={p.id}
                            href={localizedHref(`/actress/${p.id}`, locale)}
                            className="text-sm px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-colors"
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
                      <p className="text-xs theme-text-muted mb-1">{t.tags}</p>
                      <div className="flex flex-wrap gap-1">
                        {todayPick.tags.slice(0, 6).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 価格・ボタン */}
                  <div className="flex items-center gap-3 mt-4">
                    {todayPick.min_price && (
                      <span className="text-xl font-bold text-pink-400">
                        ¥{Number(todayPick.min_price).toLocaleString()}〜
                      </span>
                    )}
                    <Link
                      href={localizedHref(`/products/${todayPick.normalized_product_id}`, locale)}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors"
                    >
                      {t.viewDetails}
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 過去のピック */}
        <section>
          <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            {t.previousPicks}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {previousPicks.map((pick, idx) => (
              <Link
                key={pick.id}
                href={localizedHref(`/products/${pick.normalized_product_id}`, locale)}
                className="block rounded-lg overflow-hidden theme-card hover:ring-2 hover:ring-blue-500/50 transition-all"
              >
                <div className="aspect-video bg-gray-800 relative">
                  {pick.default_thumbnail_url ? (
                    <img
                      src={pick.default_thumbnail_url}
                      alt={pick.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-xs text-gray-300">
                    {dayLabels[idx]}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium theme-text line-clamp-2">{pick.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
