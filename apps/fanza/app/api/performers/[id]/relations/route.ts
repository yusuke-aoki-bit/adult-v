import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 60 * 30; // 30分

interface RelatedPerformer {
  id: number;
  name: string;
  nameEn: string | null;
  profileImageUrl: string | null;
  thumbnailUrl: string | null;
  costarCount: number;
  hop: number; // 1=直接共演、2=共演者の共演者、3=3ホップ目
}

interface NetworkEdge {
  source: number;
  target: number;
  weight: number;
}

interface PerformerRelationsResponse {
  success: boolean;
  performer: {
    id: number;
    name: string;
    nameEn: string | null;
    profileImageUrl: string | null;
    thumbnailUrl: string | null;
  };
  relations: RelatedPerformer[];
  edges: NetworkEdge[];
  stats: {
    totalCostarCount: number;
    mostFrequentCostar: string | null;
  };
}

/**
 * 女優関係マップAPI（3ホップネットワーク対応、FANZA専用）
 * GET /api/performers/[id]/relations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performerId = parseInt(id, 10);

    if (isNaN(performerId)) {
      return NextResponse.json(
        { error: 'Invalid performer ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const maxHops = Math.min(parseInt(searchParams.get('hops') || '2', 10), 2);
    const limitPerHop = Math.min(parseInt(searchParams.get('limit') || '8', 10), 12);

    // キャッシュチェック（v3: 3ホップネットワーク対応）
    const cacheKey = generateCacheKey('relations:fanza:v3', { performerId, maxHops, limitPerHop });
    const cached = await getCache<PerformerRelationsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const db = getDb();

    // 対象の女優情報を取得
    const performerData = await db
      .select({
        id: performers.id,
        name: performers.name,
        nameEn: performers.nameEn,
        profileImageUrl: performers.profileImageUrl,
      })
      .from(performers)
      .where(eq(performers.id, performerId))
      .limit(1);

    if (performerData.length === 0) {
      return NextResponse.json(
        { error: 'Performer not found' },
        { status: 404 }
      );
    }

    const performer = performerData[0];

    // 中心女優のサムネイル取得（FANZAソースのみ）
    const centerThumbnailQuery = await db.execute(sql`
      SELECT p.default_thumbnail_url as thumbnail_url
      FROM products p
      INNER JOIN product_performers pp ON p.id = pp.product_id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${performerId}
        AND LOWER(ps.asp_name) = 'fanza'
      ORDER BY p.release_date DESC NULLS LAST
      LIMIT 1
    `);
    const centerThumbnail = (centerThumbnailQuery.rows[0] as { thumbnail_url: string | null })?.thumbnail_url;

    // 3ホップネットワーククエリ（FANZAソースのみ）
    const networkQuery = await db.execute(sql`
      WITH RECURSIVE
      -- FANZAソースの作品のみ
      fanza_products AS (
        SELECT DISTINCT ps.product_id
        FROM product_sources ps
        WHERE LOWER(ps.asp_name) = 'fanza'
      ),
      -- 1ホップ目：直接共演者
      hop1 AS (
        SELECT DISTINCT
          pp2.performer_id,
          COUNT(DISTINCT pp2.product_id) as costar_count,
          1 as hop
        FROM product_performers pp1
        INNER JOIN fanza_products fp ON pp1.product_id = fp.product_id
        INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
        WHERE pp1.performer_id = ${performerId}
          AND pp2.performer_id != ${performerId}
        GROUP BY pp2.performer_id
        ORDER BY costar_count DESC
        LIMIT ${limitPerHop}
      ),
      -- 2ホップ目：1ホップ目の共演者の共演者
      hop2 AS (
        SELECT DISTINCT
          pp2.performer_id,
          COUNT(DISTINCT pp2.product_id) as costar_count,
          2 as hop
        FROM hop1 h1
        INNER JOIN product_performers pp1 ON h1.performer_id = pp1.performer_id
        INNER JOIN fanza_products fp ON pp1.product_id = fp.product_id
        INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
        WHERE pp2.performer_id != ${performerId}
          AND pp2.performer_id NOT IN (SELECT performer_id FROM hop1)
        GROUP BY pp2.performer_id
        ORDER BY costar_count DESC
        LIMIT ${limitPerHop}
      ),
      -- 3ホップ目：2ホップ目の共演者の共演者
      hop3 AS (
        SELECT DISTINCT
          pp2.performer_id,
          COUNT(DISTINCT pp2.product_id) as costar_count,
          3 as hop
        FROM hop2 h2
        INNER JOIN product_performers pp1 ON h2.performer_id = pp1.performer_id
        INNER JOIN fanza_products fp ON pp1.product_id = fp.product_id
        INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
        WHERE pp2.performer_id != ${performerId}
          AND pp2.performer_id NOT IN (SELECT performer_id FROM hop1)
          AND pp2.performer_id NOT IN (SELECT performer_id FROM hop2)
        GROUP BY pp2.performer_id
        ORDER BY costar_count DESC
        LIMIT ${limitPerHop}
      ),
      -- 全ホップを統合
      all_hops AS (
        SELECT * FROM hop1
        UNION ALL
        SELECT * FROM hop2
        ${maxHops >= 3 ? sql`UNION ALL SELECT * FROM hop3` : sql``}
      )
      SELECT
        ah.performer_id as id,
        p.name,
        p.name_en as "nameEn",
        p.profile_image_url as "profileImageUrl",
        ah.costar_count as "costarCount",
        ah.hop
      FROM all_hops ah
      INNER JOIN performers p ON ah.performer_id = p.id
      ORDER BY ah.hop, ah.costar_count DESC
    `);

    const relations = networkQuery.rows as Array<{
      id: number;
      name: string;
      nameEn: string | null;
      profileImageUrl: string | null;
      costarCount: number;
      hop: number;
    }>;

    // サムネイル取得（FANZAソースのみ）
    const performerIds = relations.map(r => r.id);
    const thumbnailMap = new Map<number, string | null>();

    if (performerIds.length > 0) {
      const idsArraySql = sql`ARRAY[${sql.join(performerIds.map(id => sql`${id}`), sql`, `)}]::int[]`;
      const thumbQuery = await db.execute(sql`
        SELECT DISTINCT ON (pp.performer_id)
          pp.performer_id,
          p.default_thumbnail_url as thumbnail_url
        FROM product_performers pp
        INNER JOIN products p ON pp.product_id = p.id
        INNER JOIN product_sources ps ON p.id = ps.product_id
        WHERE pp.performer_id = ANY(${idsArraySql})
          AND p.default_thumbnail_url IS NOT NULL
          AND LOWER(ps.asp_name) = 'fanza'
        ORDER BY pp.performer_id, p.release_date DESC NULLS LAST
      `);

      for (const row of thumbQuery.rows as Array<{ performer_id: number; thumbnail_url: string | null }>) {
        thumbnailMap.set(row.performer_id, row.thumbnail_url);
      }
    }

    // エッジ（関係線）を取得（FANZAソースのみ）
    const allNodeIds = [performerId, ...performerIds];
    const edgeIdsSql = sql`ARRAY[${sql.join(allNodeIds.map(id => sql`${id}`), sql`, `)}]::int[]`;

    const edgesQuery = await db.execute(sql`
      WITH node_pairs AS (
        SELECT DISTINCT
          LEAST(pp1.performer_id, pp2.performer_id) as source,
          GREATEST(pp1.performer_id, pp2.performer_id) as target,
          COUNT(DISTINCT pp1.product_id) as weight
        FROM product_performers pp1
        INNER JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
        INNER JOIN product_sources ps ON pp1.product_id = ps.product_id
        WHERE pp1.performer_id = ANY(${edgeIdsSql})
          AND pp2.performer_id = ANY(${edgeIdsSql})
          AND pp1.performer_id < pp2.performer_id
          AND LOWER(ps.asp_name) = 'fanza'
        GROUP BY pp1.performer_id, pp2.performer_id
        HAVING COUNT(DISTINCT pp1.product_id) > 0
      )
      SELECT source, target, weight FROM node_pairs
      ORDER BY weight DESC
    `);

    const edges: NetworkEdge[] = (edgesQuery.rows as Array<{ source: number; target: number; weight: number }>)
      .map(row => ({
        source: Number(row.source),
        target: Number(row.target),
        weight: Number(row.weight),
      }));

    const relationsWithThumbnails: RelatedPerformer[] = relations.map(rel => ({
      id: rel.id,
      name: rel.name,
      nameEn: rel.nameEn,
      profileImageUrl: rel.profileImageUrl,
      thumbnailUrl: thumbnailMap.get(rel.id) || null,
      costarCount: Number(rel.costarCount),
      hop: rel.hop,
    }));

    const hop1Count = relations.filter(r => r.hop === 1).length;
    const mostFrequentCostar = relations.find(r => r.hop === 1)?.name || null;

    const response: PerformerRelationsResponse = {
      success: true,
      performer: {
        id: performer.id,
        name: performer.name,
        nameEn: performer.nameEn,
        profileImageUrl: performer.profileImageUrl,
        thumbnailUrl: centerThumbnail,
      },
      relations: relationsWithThumbnails,
      edges,
      stats: {
        totalCostarCount: hop1Count,
        mostFrequentCostar,
      },
    };

    await setCache(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Performer Relations API] Error:', error);
    return NextResponse.json({
      success: false,
      fallback: true,
      performer: null,
      relations: [],
      edges: [],
      stats: { totalCostarCount: 0, mostFrequentCostar: null },
    });
  }
}
