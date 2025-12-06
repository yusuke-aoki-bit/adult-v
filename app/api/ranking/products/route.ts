import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { productSources } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

// 許可されたperiod値のホワイトリスト
const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'all'] as const;
type Period = typeof VALID_PERIODS[number];

// 制限値の範囲
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function isValidPeriod(value: string | null): value is Period {
  return value !== null && VALID_PERIODS.includes(value as Period);
}

function sanitizeLimit(value: string | null): number {
  const parsed = parseInt(value || String(DEFAULT_LIMIT), 10);
  if (isNaN(parsed) || parsed < MIN_LIMIT) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'weekly';
    const limit = sanitizeLimit(searchParams.get('limit'));

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

    // 型定義
    interface RankingRow {
      id: number;
      title: string;
      thumbnail: string | null;
      release_date: string | null;
      view_count: string | number;
      rank: string | number;
    }

    return NextResponse.json({
      period,
      ranking: (ranking.rows as RankingRow[]).map((row) => ({
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
