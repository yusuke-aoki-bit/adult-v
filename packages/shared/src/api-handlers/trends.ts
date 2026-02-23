import { NextRequest, NextResponse } from 'next/server';

export interface TrendsHandlerDeps {
  getDb: () => any;
  sql: any;
  getCache: <T>(key: string) => Promise<T | null>;
  setCache: (key: string, value: any, ttl: number) => Promise<void>;
  generateCacheKey: (prefix: string, params: Record<string, any>) => string;
}

export interface TrendsHandlerOptions {
  cachePrefix?: string;
}

export function createTrendsHandler(deps: TrendsHandlerDeps, options: TrendsHandlerOptions = {}) {
  const cachePrefix = options.cachePrefix || 'trends:web';
  const CACHE_TTL = 60 * 5;

  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'week';
      const locale = searchParams.get('locale') || 'ja';

      const cacheKey = deps.generateCacheKey(cachePrefix, { period, locale });
      const cached = await deps.getCache<any>(cacheKey);
      if (cached) return NextResponse.json(cached);

      const db = deps.getDb();
      const now = new Date();
      let currentStart: Date, previousStart: Date, previousEnd: Date;

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

      const currentTagsQuery = await db.execute(deps.sql`
        SELECT t.id, t.name, COUNT(DISTINCT pt.product_id) as count
        FROM tags t INNER JOIN product_tags pt ON t.id = pt.tag_id INNER JOIN products p ON pt.product_id = p.id
        WHERE COALESCE(p.release_date, p.created_at::date) >= ${currentStart.toISOString().split('T')[0]}
        GROUP BY t.id, t.name ORDER BY count DESC LIMIT 20
      `);

      const previousTagsQuery = await db.execute(deps.sql`
        SELECT t.name, COUNT(DISTINCT pt.product_id) as count
        FROM tags t INNER JOIN product_tags pt ON t.id = pt.tag_id INNER JOIN products p ON pt.product_id = p.id
        WHERE COALESCE(p.release_date, p.created_at::date) >= ${previousStart.toISOString().split('T')[0]}
          AND COALESCE(p.release_date, p.created_at::date) <= ${previousEnd.toISOString().split('T')[0]}
        GROUP BY t.id, t.name
      `);

      const previousTagMap = new Map<string, number>();
      for (const row of previousTagsQuery.rows as any[]) previousTagMap.set(row.name, Number(row.count));

      const tagTrends = (currentTagsQuery.rows as any[]).map((row: any) => {
        const currentCount = Number(row.count);
        const previousCount = previousTagMap.get(row.name) || 0;
        const change = previousCount > 0 ? Math.round(((currentCount - previousCount) / previousCount) * 100) : 100;
        return {
          id: Number(row.id),
          name: row.name,
          count: currentCount,
          change,
          trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
        };
      });

      const currentPerformersQuery = await db.execute(deps.sql`
        SELECT pf.id, pf.name, COUNT(DISTINCT pp.product_id) as count
        FROM performers pf INNER JOIN product_performers pp ON pf.id = pp.performer_id INNER JOIN products p ON pp.product_id = p.id
        WHERE COALESCE(p.release_date, p.created_at::date) >= ${currentStart.toISOString().split('T')[0]}
        GROUP BY pf.id, pf.name ORDER BY count DESC LIMIT 20
      `);

      const previousPerformersQuery = await db.execute(deps.sql`
        SELECT pf.name, COUNT(DISTINCT pp.product_id) as count
        FROM performers pf INNER JOIN product_performers pp ON pf.id = pp.performer_id INNER JOIN products p ON pp.product_id = p.id
        WHERE COALESCE(p.release_date, p.created_at::date) >= ${previousStart.toISOString().split('T')[0]}
          AND COALESCE(p.release_date, p.created_at::date) <= ${previousEnd.toISOString().split('T')[0]}
        GROUP BY pf.id, pf.name
      `);

      const previousPerformerMap = new Map<string, number>();
      for (const row of previousPerformersQuery.rows as any[]) previousPerformerMap.set(row.name, Number(row.count));

      const performerTrends = (currentPerformersQuery.rows as any[]).map((row: any) => {
        const currentCount = Number(row.count);
        const previousCount = previousPerformerMap.get(row.name) || 0;
        const change = previousCount > 0 ? Math.round(((currentCount - previousCount) / previousCount) * 100) : 100;
        return {
          id: Number(row.id),
          name: row.name,
          count: currentCount,
          change,
          trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
        };
      });

      const insights: string[] = [];
      const insightFormats: Record<string, any> = {
        ja: {
          rising: (names: string[]) => `「${names.join('」「')}」が人気上昇中`,
          performers: (names: string[]) => `${names.join('、')}の新作が増加`,
          topGenre: (name: string, count: number, p: string) =>
            `今${p === 'month' ? '月' : '週'}最も人気のジャンルは「${name}」(${count}作品)`,
        },
        en: {
          rising: (names: string[]) => `"${names.join('", "')}" are trending up`,
          performers: (names: string[]) => `${names.join(', ')} releasing more content`,
          topGenre: (name: string, count: number, p: string) =>
            `Most popular genre this ${p}: "${name}" (${count} releases)`,
        },
        zh: {
          rising: (names: string[]) => `「${names.join('」「')}」人气上升中`,
          performers: (names: string[]) => `${names.join('、')}的新作增加`,
          topGenre: (name: string, count: number, p: string) =>
            `本${p === 'month' ? '月' : '周'}最热门的类型是「${name}」(${count}部作品)`,
        },
        'zh-TW': {
          rising: (names: string[]) => `「${names.join('」「')}」人氣上升中`,
          performers: (names: string[]) => `${names.join('、')}的新作增加`,
          topGenre: (name: string, count: number, p: string) =>
            `本${p === 'month' ? '月' : '週'}最熱門的類型是「${name}」(${count}部作品)`,
        },
        ko: {
          rising: (names: string[]) => `"${names.join('", "')}" 인기 상승 중`,
          performers: (names: string[]) => `${names.join(', ')}의 신작 증가`,
          topGenre: (name: string, count: number, p: string) =>
            `이번 ${p === 'month' ? '달' : '주'} 가장 인기 있는 장르: "${name}" (${count}작품)`,
        },
      };
      const fmt = insightFormats[locale] || insightFormats.ja;

      const risingTags = tagTrends.filter((t: any) => t.trend === 'up').slice(0, 3);
      if (risingTags.length > 0) insights.push(fmt.rising(risingTags.map((t: any) => t.name)));
      const risingPerformers = performerTrends.filter((p: any) => p.trend === 'up').slice(0, 3);
      if (risingPerformers.length > 0) insights.push(fmt.performers(risingPerformers.map((p: any) => p.name)));
      const topTag = tagTrends[0];
      if (topTag) insights.push(fmt.topGenre(topTag.name, topTag.count, period));

      const response = {
        success: true,
        period,
        tags: tagTrends.slice(0, 10),
        performers: performerTrends.slice(0, 10),
        insights,
      };
      await deps.setCache(cacheKey, response, CACHE_TTL);

      return NextResponse.json(response);
    } catch (error) {
      console.error('[Trends API] Error:', error);
      const { searchParams } = new URL(request.url);
      return NextResponse.json({
        success: false,
        fallback: true,
        period: searchParams.get('period') || 'week',
        tags: [],
        performers: [],
        insights: [],
      });
    }
  };
}
