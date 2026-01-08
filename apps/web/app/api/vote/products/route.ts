import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * 投票可能な作品一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'best';
    const userId = searchParams.get('userId') || '';

    let dateFilter: string;
    switch (category) {
      case 'best':
        // 今月リリースの作品
        dateFilter = "p.release_date >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'trending':
        // 今週話題の作品
        dateFilter = "p.release_date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'classic':
        // 1年以上前の名作
        dateFilter = "p.release_date < CURRENT_DATE - INTERVAL '1 year' AND p.rating >= 4.0";
        break;
      default:
        dateFilter = "p.release_date >= DATE_TRUNC('month', CURRENT_DATE)";
    }

    // 投票データと作品を取得
    const productsResult = await db.execute(sql.raw(`
      WITH product_votes AS (
        SELECT
          product_id,
          COUNT(*) as vote_count
        FROM product_ranking_votes
        WHERE category = '${category}'
        GROUP BY product_id
      ),
      user_votes AS (
        SELECT product_id
        FROM product_ranking_votes
        WHERE category = '${category}'
          AND user_id = '${userId}'
      )
      SELECT
        p.id,
        p.title,
        p.default_thumbnail_url as "imageUrl",
        p.release_date::text as "releaseDate",
        COALESCE(pv.vote_count, 0)::int as "voteCount",
        CASE WHEN uv.product_id IS NOT NULL THEN true ELSE false END as "hasVoted",
        COALESCE(
          (SELECT array_agg(pf.name ORDER BY pf.name)
           FROM product_performers pp
           INNER JOIN performers pf ON pp.performer_id = pf.id
           WHERE pp.product_id = p.id),
          ARRAY[]::text[]
        ) as performers
      FROM products p
      LEFT JOIN product_votes pv ON p.id = pv.product_id
      LEFT JOIN user_votes uv ON p.id = uv.product_id
      WHERE ${dateFilter}
      ORDER BY COALESCE(pv.vote_count, 0) DESC, p.rating DESC NULLS LAST
      LIMIT 20
    `));

    // 統計情報
    const statsResult = await db.execute(sql.raw(`
      SELECT
        COUNT(*)::int as total_votes,
        COUNT(DISTINCT user_id)::int as participants
      FROM product_ranking_votes
      WHERE category = '${category}'
    `));

    const products = (productsResult.rows as Array<Record<string, unknown>>).map((row, index) => ({
      id: row.id as number,
      title: row.title as string,
      imageUrl: row.imageUrl as string | null,
      releaseDate: row.releaseDate as string | null,
      voteCount: Number(row.voteCount),
      hasVoted: row.hasVoted as boolean,
      performers: (row.performers as string[]) || [],
      rank: index + 1,
    }));

    const stats = statsResult.rows[0] as { total_votes: number; participants: number } | undefined;

    return NextResponse.json({
      products,
      totalVotes: stats?.total_votes || 0,
      participants: stats?.participants || 0,
    });
  } catch (error) {
    console.error('Vote products fetch error:', error);
    // テーブルが存在しない場合は空のデータを返す
    return NextResponse.json({
      products: [],
      totalVotes: 0,
      participants: 0,
    });
  }
}
