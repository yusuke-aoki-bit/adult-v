import { NextRequest, NextResponse } from 'next/server';

export interface PerformerRelationsHandlerDeps {
  getDb: () => any;
  performers: any;
  sql: any;
  eq: any;
  getCache: <T>(key: string) => Promise<T | null>;
  setCache: (key: string, value: any, ttl: number) => Promise<void>;
  generateCacheKey: (prefix: string, params: Record<string, any>) => string;
}

export interface PerformerRelationsHandlerOptions {
  cachePrefix?: string;
}

export function createPerformerRelationsHandler(deps: PerformerRelationsHandlerDeps, options: PerformerRelationsHandlerOptions = {}) {
  const cachePrefix = options.cachePrefix || 'relations:web:v5';
  const CACHE_TTL = 60 * 30;

  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;
      const performerId = parseInt(id, 10);
      if (isNaN(performerId)) return NextResponse.json({ error: 'Invalid performer ID' }, { status: 400 });

      const { searchParams } = new URL(request.url);
      const maxHops = Math.min(parseInt(searchParams.get('hops') || '2', 10), 2);
      const limitPerHop = Math.min(parseInt(searchParams.get('limit') || '8', 10), 12);

      const cacheKey = deps.generateCacheKey(cachePrefix, { performerId, maxHops, limitPerHop });
      const cached = await deps.getCache<any>(cacheKey);
      if (cached) return NextResponse.json(cached);

      const db = deps.getDb();

      const performerData = await db.select({ id: deps.performers.id, name: deps.performers.name, nameEn: deps.performers.nameEn, profileImageUrl: deps.performers.profileImageUrl })
        .from(deps.performers).where(deps.eq(deps.performers.id, performerId)).limit(1);
      if (performerData.length === 0) return NextResponse.json({ error: 'Performer not found' }, { status: 404 });
      const performer = performerData[0];

      const centerThumbnailQuery = await db.execute(deps.sql`
        SELECT COALESCE(
          (SELECT pi.image_url FROM product_images pi INNER JOIN product_performers pp ON pi.product_id = pp.product_id
           WHERE pp.performer_id = ${performerId} AND pi.image_type = 'thumbnail' AND pi.asp_name IS NOT NULL AND pi.asp_name != 'FANZA' LIMIT 1),
          (SELECT p.default_thumbnail_url FROM products p INNER JOIN product_performers pp ON p.id = pp.product_id
           WHERE pp.performer_id = ${performerId} ORDER BY p.release_date DESC NULLS LAST LIMIT 1)
        ) as thumbnail_url
      `);
      const centerThumbnail = (centerThumbnailQuery.rows[0] as any)?.thumbnail_url;

      const networkQuery = await db.execute(deps.sql`
        WITH RECURSIVE
        hop1 AS (
          SELECT DISTINCT pp2.performer_id, COUNT(DISTINCT pp2.product_id) as costar_count, 1 as hop
          FROM product_performers pp1 INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
          WHERE pp1.performer_id = ${performerId} AND pp2.performer_id != ${performerId}
          GROUP BY pp2.performer_id ORDER BY costar_count DESC LIMIT ${limitPerHop}
        ),
        hop2 AS (
          SELECT DISTINCT pp2.performer_id, COUNT(DISTINCT pp2.product_id) as costar_count, 2 as hop
          FROM hop1 h1 INNER JOIN product_performers pp1 ON h1.performer_id = pp1.performer_id INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
          WHERE pp2.performer_id != ${performerId} AND pp2.performer_id NOT IN (SELECT performer_id FROM hop1)
          GROUP BY pp2.performer_id ORDER BY costar_count DESC LIMIT ${limitPerHop}
        ),
        hop3 AS (
          SELECT DISTINCT pp2.performer_id, COUNT(DISTINCT pp2.product_id) as costar_count, 3 as hop
          FROM hop2 h2 INNER JOIN product_performers pp1 ON h2.performer_id = pp1.performer_id INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
          WHERE pp2.performer_id != ${performerId} AND pp2.performer_id NOT IN (SELECT performer_id FROM hop1) AND pp2.performer_id NOT IN (SELECT performer_id FROM hop2)
          GROUP BY pp2.performer_id ORDER BY costar_count DESC LIMIT ${limitPerHop}
        ),
        all_hops AS (
          SELECT * FROM hop1 UNION ALL SELECT * FROM hop2 ${maxHops >= 3 ? deps.sql`UNION ALL SELECT * FROM hop3` : deps.sql``}
        )
        SELECT ah.performer_id as id, p.name, p.name_en as "nameEn", p.profile_image_url as "profileImageUrl", ah.costar_count as "costarCount", ah.hop
        FROM all_hops ah INNER JOIN performers p ON ah.performer_id = p.id
        ORDER BY ah.hop, ah.costar_count DESC
      `);

      const relations = networkQuery.rows as any[];
      const performerIds = relations.map((r: any) => r.id);
      const thumbnailMap = new Map<number, string | null>();

      if (performerIds.length > 0) {
        const idsArraySql = deps.sql`ARRAY[${deps.sql.join(performerIds.map((id: number) => deps.sql`${id}`), deps.sql`, `)}]::int[]`;
        const thumbQuery = await db.execute(deps.sql`
          SELECT DISTINCT ON (pp.performer_id) pp.performer_id,
            COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_type = 'thumbnail' AND pi.asp_name IS NOT NULL AND pi.asp_name != 'FANZA' ORDER BY pi.display_order NULLS LAST LIMIT 1), p.default_thumbnail_url) as thumbnail_url
          FROM product_performers pp INNER JOIN products p ON pp.product_id = p.id
          WHERE pp.performer_id = ANY(${idsArraySql}) AND p.default_thumbnail_url IS NOT NULL
          ORDER BY pp.performer_id, p.release_date DESC NULLS LAST
        `);
        for (const row of thumbQuery.rows as any[]) thumbnailMap.set(row.performer_id, row.thumbnail_url);
      }

      const allNodeIds = [performerId, ...performerIds];
      const edgeIdsSql = deps.sql`ARRAY[${deps.sql.join(allNodeIds.map((id: number) => deps.sql`${id}`), deps.sql`, `)}]::int[]`;
      const edgesQuery = await db.execute(deps.sql`
        WITH node_pairs AS (
          SELECT DISTINCT LEAST(pp1.performer_id, pp2.performer_id) as source, GREATEST(pp1.performer_id, pp2.performer_id) as target, COUNT(DISTINCT pp1.product_id) as weight
          FROM product_performers pp1 INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
          WHERE pp1.performer_id = ANY(${edgeIdsSql}) AND pp2.performer_id = ANY(${edgeIdsSql}) AND pp1.performer_id < pp2.performer_id
          GROUP BY pp1.performer_id, pp2.performer_id HAVING COUNT(DISTINCT pp1.product_id) > 0
        ) SELECT source, target, weight FROM node_pairs ORDER BY weight DESC
      `);

      const edges = (edgesQuery.rows as any[]).map((row: any) => ({ source: Number(row.source), target: Number(row.target), weight: Number(row.weight) }));
      const relationsWithThumbnails = relations.map((rel: any) => ({ id: rel.id, name: rel.name, nameEn: rel.nameEn, profileImageUrl: rel.profileImageUrl, thumbnailUrl: thumbnailMap.get(rel.id) || null, costarCount: Number(rel.costarCount), hop: rel.hop }));

      const hop1Count = relations.filter((r: any) => r.hop === 1).length;
      const mostFrequentCostar = relations.find((r: any) => r.hop === 1)?.name || null;

      const response = {
        success: true,
        performer: { id: performer.id, name: performer.name, nameEn: performer.nameEn, profileImageUrl: performer.profileImageUrl, thumbnailUrl: centerThumbnail },
        relations: relationsWithThumbnails, edges,
        stats: { totalCostarCount: hop1Count, mostFrequentCostar },
      };

      await deps.setCache(cacheKey, response, CACHE_TTL);
      return NextResponse.json(response);
    } catch (error) {
      console.error('[Performer Relations API] Error:', error);
      return NextResponse.json({ success: false, fallback: true, performer: null, relations: [], edges: [], stats: { totalCostarCount: 0, mostFrequentCostar: null } });
    }
  };
}
