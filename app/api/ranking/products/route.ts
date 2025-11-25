import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources } from '@/lib/db/schema';
import { sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

interface RankingParams {
  period?: 'daily' | 'weekly' | 'monthly' | 'all';
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'weekly') as RankingParams['period'];
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const db = getDb();

    // Calculate date range based on period
    let dateCondition = sql`TRUE`;
    switch (period) {
      case 'daily':
        dateCondition = sql`pv.viewed_at >= NOW() - INTERVAL '1 day'`;
        break;
      case 'weekly':
        dateCondition = sql`pv.viewed_at >= NOW() - INTERVAL '7 days'`;
        break;
      case 'monthly':
        dateCondition = sql`pv.viewed_at >= NOW() - INTERVAL '30 days'`;
        break;
      case 'all':
        dateCondition = sql`TRUE`;
        break;
    }

    // Get ranking with view counts (excluding DTI)
    const ranking = await db.execute(sql`
      SELECT
        p.id,
        p.title,
        p.default_thumbnail_url as thumbnail,
        p.release_date,
        COUNT(pv.id) as view_count,
        RANK() OVER (ORDER BY COUNT(pv.id) DESC) as rank
      FROM products p
      LEFT JOIN product_views pv ON p.id = pv.product_id AND ${dateCondition}
      WHERE NOT EXISTS (
        SELECT 1 FROM ${productSources} ps
        WHERE ps.product_id = p.id
        AND ps.asp_name = 'DTI'
      )
      GROUP BY p.id, p.title, p.default_thumbnail_url, p.release_date
      HAVING COUNT(pv.id) > 0
      ORDER BY view_count DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({
      period,
      ranking: ranking.rows.map((row: any) => ({
        rank: Number(row.rank),
        productId: row.id,
        title: row.title,
        thumbnail: row.thumbnail,
        releaseDate: row.release_date,
        viewCount: Number(row.view_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching product ranking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ranking' },
      { status: 500 }
    );
  }
}
