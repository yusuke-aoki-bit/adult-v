import { Metadata } from 'next';
import Link from 'next/link';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { Heart, List, TrendingUp, Clock, Star, Eye, Users, Film, Crown, Medal } from 'lucide-react';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

interface PublicList {
  id: number;
  title: string;
  description: string | null;
  userId: string;
  creatorName: string;
  itemCount: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  previewImages: string[];
  tags: string[];
  rank: number;
}

interface ListRankingData {
  popularLists: PublicList[];
  recentLists: PublicList[];
  trendingLists: PublicList[];
  stats: {
    totalLists: number;
    totalItems: number;
    totalLikes: number;
  };
}

async function getListRankingData(): Promise<ListRankingData> {
  const db = getDb();

  const emptyResult: ListRankingData = {
    popularLists: [],
    recentLists: [],
    trendingLists: [],
    stats: { totalLists: 0, totalItems: 0, totalLikes: 0 },
  };

  // テーブル存在チェック（マイグレーション未適用の場合エラー回避）
  // public_favorite_lists, public_list_items, public_list_likes, user_profilesが必要
  try {
    const tableCheck = await db.execute(sql`
      SELECT
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_favorite_lists')) as has_lists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_list_items')) as has_items,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_list_likes')) as has_likes
    `);
    const check = tableCheck.rows[0] as { has_lists: boolean; has_items: boolean; has_likes: boolean };
    if (!check?.has_lists || !check?.has_items || !check?.has_likes) {
      return emptyResult;
    }
  } catch {
    return emptyResult;
  }

  try {
    // 人気リスト（いいね数順）TOP 20
    const popularListsResult = await db.execute(sql`
    WITH list_stats AS (
      SELECT
        pfl.id,
        pfl.title,
        pfl.description,
        pfl.user_id,
        COALESCE(
          (SELECT display_name FROM user_profiles WHERE user_id = pfl.user_id LIMIT 1),
          CONCAT('User_', LEFT(pfl.user_id, 8))
        ) as creator_name,
        (SELECT COUNT(*) FROM public_list_items WHERE list_id = pfl.id)::int as item_count,
        (SELECT COUNT(*) FROM public_list_likes WHERE list_id = pfl.id)::int as like_count,
        COALESCE(pfl.view_count, 0)::int as view_count,
        pfl.created_at::text as created_at,
        pfl.updated_at::text as updated_at,
        COALESCE(
          (SELECT array_agg(p.default_thumbnail_url ORDER BY pli.position)
           FROM public_list_items pli
           INNER JOIN products p ON pli.product_id = p.id
           WHERE pli.list_id = pfl.id AND p.default_thumbnail_url IS NOT NULL
           LIMIT 4),
          ARRAY[]::text[]
        ) as preview_images
      FROM public_favorite_lists pfl
      WHERE pfl.is_public = true
    ),
    list_tags AS (
      SELECT
        pli.list_id,
        array_agg(DISTINCT t.name ORDER BY t.name) as tags
      FROM public_list_items pli
      INNER JOIN product_tags pt ON pli.product_id = pt.product_id
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE t.category = 'genre'
      GROUP BY pli.list_id
    )
    SELECT
      ls.*,
      COALESCE(lt.tags[1:5], ARRAY[]::text[]) as tags,
      ROW_NUMBER() OVER (ORDER BY ls.like_count DESC, ls.view_count DESC)::int as rank
    FROM list_stats ls
    LEFT JOIN list_tags lt ON ls.id = lt.list_id
    WHERE ls.item_count >= 3
    ORDER BY ls.like_count DESC, ls.view_count DESC
    LIMIT 20
  `);

    // 最近のリスト
    const recentListsResult = await db.execute(sql`
    WITH list_stats AS (
      SELECT
        pfl.id,
        pfl.title,
        pfl.description,
        pfl.user_id,
        COALESCE(
          (SELECT display_name FROM user_profiles WHERE user_id = pfl.user_id LIMIT 1),
          CONCAT('User_', LEFT(pfl.user_id, 8))
        ) as creator_name,
        (SELECT COUNT(*) FROM public_list_items WHERE list_id = pfl.id)::int as item_count,
        (SELECT COUNT(*) FROM public_list_likes WHERE list_id = pfl.id)::int as like_count,
        COALESCE(pfl.view_count, 0)::int as view_count,
        pfl.created_at::text as created_at,
        pfl.updated_at::text as updated_at,
        COALESCE(
          (SELECT array_agg(p.default_thumbnail_url ORDER BY pli.position)
           FROM public_list_items pli
           INNER JOIN products p ON pli.product_id = p.id
           WHERE pli.list_id = pfl.id AND p.default_thumbnail_url IS NOT NULL
           LIMIT 4),
          ARRAY[]::text[]
        ) as preview_images
      FROM public_favorite_lists pfl
      WHERE pfl.is_public = true
        AND pfl.created_at >= CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT
      ls.*,
      ARRAY[]::text[] as tags,
      ROW_NUMBER() OVER (ORDER BY ls.created_at DESC)::int as rank
    FROM list_stats ls
    WHERE ls.item_count >= 3
    ORDER BY ls.created_at DESC
    LIMIT 10
  `);

    // トレンドリスト（最近の閲覧数増加）
    const trendingListsResult = await db.execute(sql`
    WITH list_stats AS (
      SELECT
        pfl.id,
        pfl.title,
        pfl.description,
        pfl.user_id,
        COALESCE(
          (SELECT display_name FROM user_profiles WHERE user_id = pfl.user_id LIMIT 1),
          CONCAT('User_', LEFT(pfl.user_id, 8))
        ) as creator_name,
        (SELECT COUNT(*) FROM public_list_items WHERE list_id = pfl.id)::int as item_count,
        (SELECT COUNT(*) FROM public_list_likes WHERE list_id = pfl.id)::int as like_count,
        COALESCE(pfl.view_count, 0)::int as view_count,
        pfl.created_at::text as created_at,
        pfl.updated_at::text as updated_at,
        COALESCE(
          (SELECT array_agg(p.default_thumbnail_url ORDER BY pli.position)
           FROM public_list_items pli
           INNER JOIN products p ON pli.product_id = p.id
           WHERE pli.list_id = pfl.id AND p.default_thumbnail_url IS NOT NULL
           LIMIT 4),
          ARRAY[]::text[]
        ) as preview_images
      FROM public_favorite_lists pfl
      WHERE pfl.is_public = true
        AND pfl.updated_at >= CURRENT_DATE - INTERVAL '7 days'
    )
    SELECT
      ls.*,
      ARRAY[]::text[] as tags,
      ROW_NUMBER() OVER (ORDER BY (ls.like_count + ls.view_count) DESC)::int as rank
    FROM list_stats ls
    WHERE ls.item_count >= 3
    ORDER BY (ls.like_count + ls.view_count) DESC
    LIMIT 10
  `);

    // 統計
    const statsResult = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM public_favorite_lists WHERE is_public = true)::int as total_lists,
      (SELECT COUNT(*) FROM public_list_items pli
       INNER JOIN public_favorite_lists pfl ON pli.list_id = pfl.id
       WHERE pfl.is_public = true)::int as total_items,
      (SELECT COUNT(*) FROM public_list_likes pll
       INNER JOIN public_favorite_lists pfl ON pll.list_id = pfl.id
       WHERE pfl.is_public = true)::int as total_likes
  `);

    const mapList = (row: Record<string, unknown>): PublicList => ({
      id: row.id as number,
      title: row.title as string,
      description: row.description as string | null,
      userId: row.user_id as string,
      creatorName: row.creator_name as string,
      itemCount: Number(row.item_count),
      likeCount: Number(row.like_count),
      viewCount: Number(row.view_count),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      previewImages: (row.preview_images as string[]) || [],
      tags: (row.tags as string[]) || [],
      rank: Number(row.rank),
    });

    const stats = statsResult.rows[0] as { total_lists: number; total_items: number; total_likes: number };

    return {
      popularLists: (popularListsResult.rows as Array<Record<string, unknown>>).map(mapList),
      recentLists: (recentListsResult.rows as Array<Record<string, unknown>>).map(mapList),
      trendingLists: (trendingListsResult.rows as Array<Record<string, unknown>>).map(mapList),
      stats: {
        totalLists: stats?.total_lists || 0,
        totalItems: stats?.total_items || 0,
        totalLikes: stats?.total_likes || 0,
      },
    };
  } catch (error) {
    console.error('Failed to fetch list ranking data:', error);
    return emptyResult;
  }
}

const translations = {
  ja: {
    title: '公開リストランキング',
    subtitle: 'ユーザーが作成した人気リストをランキングで紹介',
    popularLists: '人気のリスト TOP 20',
    recentLists: '新着リスト',
    trendingLists: '急上昇リスト',
    items: '作品',
    likes: 'いいね',
    views: '閲覧',
    by: '作成:',
    totalLists: '公開リスト数',
    totalItems: '総作品数',
    totalLikes: '総いいね数',
    noData: 'データがありません',
    viewList: 'リストを見る',
    backToLists: 'リスト一覧に戻る',
    listsBreadcrumb: 'リスト',
  },
  en: {
    title: 'Public List Rankings',
    subtitle: 'Discover the most popular curated lists from our community',
    popularLists: 'Popular Lists TOP 20',
    recentLists: 'Recent Lists',
    trendingLists: 'Trending Lists',
    items: 'items',
    likes: 'likes',
    views: 'views',
    by: 'by',
    totalLists: 'Public Lists',
    totalItems: 'Total Items',
    totalLikes: 'Total Likes',
    noData: 'No data available',
    viewList: 'View List',
    backToLists: 'Back to Lists',
    listsBreadcrumb: 'Lists',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(t.title, t.subtitle, undefined, '/lists/ranking', undefined, locale);
}

export default async function ListRankingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const data = await getListRankingData();

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
    return <span className="flex h-6 w-6 items-center justify-center text-sm font-bold text-gray-500">#{rank}</span>;
  }

  function getRankBg(rank: number) {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border-yellow-500/30';
    if (rank === 2) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-r from-amber-900/30 to-orange-900/20 border-amber-600/30';
    return 'bg-gray-800/30 border-gray-700/50';
  }

  function ListCard({ list, showRank = true }: { list: PublicList; showRank?: boolean }) {
    return (
      <Link
        href={localizedHref(`/lists/${list.id}`, locale)}
        className={`group theme-card overflow-hidden rounded-lg border transition-all hover:ring-2 hover:ring-fuchsia-500/50 ${showRank ? getRankBg(list.rank) : 'border-gray-700/50'}`}
      >
        <div className="flex">
          {/* ランク */}
          {showRank && (
            <div className="flex w-16 flex-shrink-0 items-center justify-center">{getRankIcon(list.rank)}</div>
          )}

          {/* プレビュー画像 */}
          <div className="relative aspect-square w-24 flex-shrink-0 overflow-hidden bg-gray-700">
            {list.previewImages.length > 0 ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
                {list.previewImages.slice(0, 4).map((img, i) => (
                  <div key={i} className="overflow-hidden bg-gray-800">
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-500">
                <List className="h-8 w-8" />
              </div>
            )}
          </div>

          {/* コンテンツ */}
          <div className="min-w-0 flex-1 p-4">
            <h3 className="theme-text mb-1 line-clamp-1 font-bold transition-colors group-hover:text-fuchsia-400">
              {list.title}
            </h3>
            {list.description && <p className="theme-text-muted mb-2 line-clamp-1 text-sm">{list.description}</p>}
            <div className="theme-text-muted flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <Film className="h-3 w-3" />
                {list.itemCount} {t.items}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-fuchsia-400" />
                {list.likeCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {list.viewCount}
              </span>
            </div>
            <div className="theme-text-muted mt-2 flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              <span>
                {t.by} {list.creatorName}
              </span>
            </div>
          </div>
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
              { label: t.listsBreadcrumb, href: localizedHref('/lists', locale) },
              { label: t.title },
            ]}
            className="mb-4"
          />

          {/* PR表記 */}
          <p className="theme-text-muted mb-6 text-xs">
            <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

          {/* ヘッダー */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-white">
              <Star className="h-5 w-5" />
              <span className="font-bold">LIST RANKINGS</span>
            </div>
            <h1 className="theme-text mb-2 text-3xl font-bold">{t.title}</h1>
            <p className="theme-text-muted">{t.subtitle}</p>
          </div>

          {/* 統計カード */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="theme-card rounded-lg p-6 text-center">
              <List className="mx-auto mb-2 h-8 w-8 text-blue-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.totalLists}</div>
              <div className="theme-text-muted text-sm">{t.totalLists}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Film className="mx-auto mb-2 h-8 w-8 text-purple-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.totalItems}</div>
              <div className="theme-text-muted text-sm">{t.totalItems}</div>
            </div>
            <div className="theme-card rounded-lg p-6 text-center">
              <Heart className="mx-auto mb-2 h-8 w-8 text-fuchsia-400" />
              <div className="theme-text text-3xl font-bold">{data.stats.totalLikes}</div>
              <div className="theme-text-muted text-sm">{t.totalLikes}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* 人気リスト TOP 20 */}
            <div className="lg:col-span-2">
              <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
                <Crown className="h-5 w-5 text-yellow-400" />
                {t.popularLists}
              </h2>
              {data.popularLists.length > 0 ? (
                <div className="space-y-3">
                  {data.popularLists.map((list) => (
                    <ListCard key={list.id} list={list} />
                  ))}
                </div>
              ) : (
                <div className="theme-card theme-text-muted rounded-lg p-8 text-center">{t.noData}</div>
              )}
            </div>

            {/* サイドバー */}
            <div className="space-y-8">
              {/* 急上昇リスト */}
              <div>
                <h2 className="theme-text mb-4 flex items-center gap-2 text-lg font-bold">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  {t.trendingLists}
                </h2>
                {data.trendingLists.length > 0 ? (
                  <div className="space-y-3">
                    {data.trendingLists.slice(0, 5).map((list) => (
                      <ListCard key={list.id} list={list} showRank={false} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card theme-text-muted rounded-lg p-4 text-center text-sm">{t.noData}</div>
                )}
              </div>

              {/* 新着リスト */}
              <div>
                <h2 className="theme-text mb-4 flex items-center gap-2 text-lg font-bold">
                  <Clock className="h-5 w-5 text-blue-400" />
                  {t.recentLists}
                </h2>
                {data.recentLists.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentLists.slice(0, 5).map((list) => (
                      <ListCard key={list.id} list={list} showRank={false} />
                    ))}
                  </div>
                ) : (
                  <div className="theme-card theme-text-muted rounded-lg p-4 text-center text-sm">{t.noData}</div>
                )}
              </div>
            </div>
          </div>

          {/* リスト一覧へのリンク */}
          <div className="mt-8 text-center">
            <Link
              href={localizedHref('/lists', locale)}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-6 py-3 text-white transition-colors hover:bg-gray-700"
            >
              <List className="h-5 w-5" />
              {t.backToLists}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
