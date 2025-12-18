import { NextRequest, NextResponse } from 'next/server';
import { sql, SQL } from 'drizzle-orm';

type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export interface RankingActressesHandlerDeps {
  getDb: () => {
    execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>;
  };
  performers: unknown;
}

export function createRankingActressesHandler(deps: RankingActressesHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const period = (searchParams.get('period') || 'weekly') as RankingPeriod;
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      const db = deps.getDb();

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

      // Get actress ranking with view counts
      const ranking = await db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.image_url as image,
          COUNT(pv.id) as view_count,
          RANK() OVER (ORDER BY COUNT(pv.id) DESC) as rank
        FROM ${deps.performers as SQL} p
        LEFT JOIN performer_views pv ON p.id = pv.performer_id AND ${dateCondition}
        GROUP BY p.id, p.name, p.image_url
        HAVING COUNT(pv.id) > 0
        ORDER BY view_count DESC
        LIMIT ${limit}
      `);

      return NextResponse.json({
        period,
        ranking: ranking.rows.map((row) => ({
          rank: Number(row.rank),
          performerId: row.id,
          name: row.name,
          image: row.image,
          viewCount: Number(row.view_count),
        })),
      });
    } catch (error) {
      console.error('Error fetching actress ranking:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ranking' },
        { status: 500 }
      );
    }
  };
}
