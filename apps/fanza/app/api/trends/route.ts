import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';

export const revalidate = 60; // 1分キャッシュ
export const runtime = 'nodejs';

const CACHE_TTL = 60 * 5; // 5分

interface TrendItem {
  name: string;
  count: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendsResponse {
  success: boolean;
  period: string;
  tags: TrendItem[];
  performers: TrendItem[];
  insights: string[];
}

/**
 * トレンド分析API (FANZA専用)
 * GET /api/trends?period=week|month
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const locale = searchParams.get('locale') || 'ja';

    // キャッシュチェック
    const cacheKey = generateCacheKey('trends:fanza', { period, locale });
    const cached = await getCache<TrendsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const db = getDb();

    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (period === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      const dayOfWeek = now.getDay();
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - dayOfWeek);
      currentStart.setHours(0, 0, 0, 0);
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
    }

    // FANZA専用：現在期間のタグトレンド（release_dateがNULLの場合はcreated_atで代用）
    const currentTagsQuery = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        COUNT(DISTINCT pt.product_id) as count
      FROM tags t
      INNER JOIN product_tags pt ON t.id = pt.tag_id
      INNER JOIN products p ON pt.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE COALESCE(p.release_date, p.created_at::date) >= ${currentStart.toISOString().split('T')[0]}
        AND LOWER(ps.asp_name) = 'fanza'
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 20
    `);

    const previousTagsQuery = await db.execute(sql`
      SELECT
        t.name,
        COUNT(DISTINCT pt.product_id) as count
      FROM tags t
      INNER JOIN product_tags pt ON t.id = pt.tag_id
      INNER JOIN products p ON pt.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE COALESCE(p.release_date, p.created_at::date) >= ${previousStart.toISOString().split('T')[0]}
        AND COALESCE(p.release_date, p.created_at::date) <= ${previousEnd.toISOString().split('T')[0]}
        AND LOWER(ps.asp_name) = 'fanza'
      GROUP BY t.id, t.name
    `);

    const previousTagMap = new Map<string, number>();
    for (const row of previousTagsQuery.rows as Array<{ name: string; count: number }>) {
      previousTagMap.set(row.name, Number(row.count));
    }

    const tagTrends: (TrendItem & { id?: number })[] = (currentTagsQuery.rows as Array<{ id: number; name: string; count: number }>).map(row => {
      const currentCount = Number(row.count);
      const previousCount = previousTagMap.get(row.name) || 0;
      const change = previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : 100;
      return {
        id: Number(row.id),
        name: row.name,
        count: currentCount,
        change,
        trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
      };
    });

    // FANZA専用：現在期間の女優トレンド
    const currentPerformersQuery = await db.execute(sql`
      SELECT
        pf.id,
        pf.name,
        COUNT(DISTINCT pp.product_id) as count
      FROM performers pf
      INNER JOIN product_performers pp ON pf.id = pp.performer_id
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE COALESCE(p.release_date, p.created_at::date) >= ${currentStart.toISOString().split('T')[0]}
        AND LOWER(ps.asp_name) = 'fanza'
      GROUP BY pf.id, pf.name
      ORDER BY count DESC
      LIMIT 20
    `);

    const previousPerformersQuery = await db.execute(sql`
      SELECT
        pf.name,
        COUNT(DISTINCT pp.product_id) as count
      FROM performers pf
      INNER JOIN product_performers pp ON pf.id = pp.performer_id
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE COALESCE(p.release_date, p.created_at::date) >= ${previousStart.toISOString().split('T')[0]}
        AND COALESCE(p.release_date, p.created_at::date) <= ${previousEnd.toISOString().split('T')[0]}
        AND LOWER(ps.asp_name) = 'fanza'
      GROUP BY pf.id, pf.name
    `);

    const previousPerformerMap = new Map<string, number>();
    for (const row of previousPerformersQuery.rows as Array<{ name: string; count: number }>) {
      previousPerformerMap.set(row.name, Number(row.count));
    }

    const performerTrends: (TrendItem & { id?: number })[] = (currentPerformersQuery.rows as Array<{ id: number; name: string; count: number }>).map(row => {
      const currentCount = Number(row.count);
      const previousCount = previousPerformerMap.get(row.name) || 0;
      const change = previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : 100;
      return {
        id: Number(row.id),
        name: row.name,
        count: currentCount,
        change,
        trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
      };
    });

    const insights: string[] = [];
    const insightFormats: Record<string, { rising: (names: string[]) => string; performers: (names: string[]) => string; topGenre: (name: string, count: number, period: string) => string }> = {
      ja: {
        rising: (names) => `「${names.join('」「')}」が人気上昇中`,
        performers: (names) => `${names.join('、')}の新作が増加`,
        topGenre: (name, count, p) => `今${p === 'month' ? '月' : '週'}最も人気のジャンルは「${name}」(${count}作品)`,
      },
      en: {
        rising: (names) => `"${names.join('", "')}" are trending up`,
        performers: (names) => `${names.join(', ')} releasing more content`,
        topGenre: (name, count, p) => `Most popular genre this ${p}: "${name}" (${count} releases)`,
      },
    };
    const fmt = insightFormats[locale] || insightFormats.ja;

    const risingTags = tagTrends.filter(t => t.trend === 'up').slice(0, 3);
    if (risingTags.length > 0) {
      insights.push(fmt.rising(risingTags.map(t => t.name)));
    }

    const risingPerformers = performerTrends.filter(p => p.trend === 'up').slice(0, 3);
    if (risingPerformers.length > 0) {
      insights.push(fmt.performers(risingPerformers.map(p => p.name)));
    }

    const topTag = tagTrends[0];
    if (topTag) {
      insights.push(fmt.topGenre(topTag.name, topTag.count, period));
    }

    const response: TrendsResponse = {
      success: true,
      period,
      tags: tagTrends.slice(0, 10),
      performers: performerTrends.slice(0, 10),
      insights,
    };

    // キャッシュに保存
    await setCache(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Trends API] Error:', error);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    return NextResponse.json({
      success: false,
      fallback: true,
      period,
      tags: [],
      performers: [],
      insights: [],
    });
  }
}
