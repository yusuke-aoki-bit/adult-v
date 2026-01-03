import { sql, eq } from 'drizzle-orm';

export interface PerformerSimilarHandlerDeps {
  getDb: () => {
    select: (fields: Record<string, unknown>) => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          limit: (n: number) => Promise<unknown[]>;
        };
      };
    };
    execute: (query: unknown) => Promise<{ rows: unknown[] }>;
  };
  performers: unknown;
  getCache: <T>(key: string) => Promise<T | null>;
  setCache: (key: string, value: unknown, ttl: number) => Promise<void>;
  generateCacheKey: (prefix: string, params: Record<string, unknown>) => string;
  aspName: string;
}

export interface PerformerSimilarHandlerOptions {
  siteMode: 'fanza' | 'mgs';
}

interface SimilarPerformer {
  id: number;
  name: string;
  nameEn: string | null;
  profileImageUrl: string | null;
  thumbnailUrl: string | null;
  similarityScore: number;
  similarityReasons: string[];
  genreScore: number;
  makerScore: number;
  profileScore: number;
  hop: number; // 1=プロフィール類似、2=ジャンル類似
}

interface NetworkEdge {
  source: number;
  target: number;
  weight: number;
}

interface PerformerSimilarityResponse {
  success: boolean;
  performer: {
    id: number;
    name: string;
    nameEn: string | null;
    profileImageUrl: string | null;
    thumbnailUrl: string | null;
  };
  similar: SimilarPerformer[];
  edges: NetworkEdge[];
  stats: {
    totalSimilarCount: number;
    avgSimilarityScore: number;
  };
}

const CACHE_TTL = 60 * 60; // 1時間

export function createPerformerSimilarHandler(
  deps: PerformerSimilarHandlerDeps,
  options: PerformerSimilarHandlerOptions
) {
  const { getDb, performers, getCache, setCache, generateCacheKey } = deps;
  const { siteMode } = options;
  const isFanza = siteMode === 'fanza';
  const cachePrefix = isFanza ? 'similar:fanza:v6' : 'similar:mgs:v6';

  return async function handlePerformerSimilar(
    performerId: number,
    limit: number = 20
  ): Promise<{ data?: PerformerSimilarityResponse; error?: string; status: number }> {
    try {
      if (isNaN(performerId)) {
        return { error: 'Invalid performer ID', status: 400 };
      }

      const safeLimit = Math.min(limit, 50);

      // キャッシュチェック
      const cacheKey = generateCacheKey(cachePrefix, { performerId, limit: safeLimit });
      const cached = await getCache<PerformerSimilarityResponse>(cacheKey);
      if (cached) {
        return { data: cached, status: 200 };
      }

      const db = getDb();

      // 対象の女優情報を取得
      const performerData = await (db as ReturnType<typeof getDb>)
        .select({
          id: (performers as { id: unknown }).id,
          name: (performers as { name: unknown }).name,
          nameEn: (performers as { nameEn: unknown }).nameEn,
          profileImageUrl: (performers as { profileImageUrl: unknown }).profileImageUrl,
          height: (performers as { height: unknown }).height,
          bust: (performers as { bust: unknown }).bust,
          waist: (performers as { waist: unknown }).waist,
          hip: (performers as { hip: unknown }).hip,
          cup: (performers as { cup: unknown }).cup,
          birthday: (performers as { birthday: unknown }).birthday,
        })
        .from(performers)
        .where(eq((performers as { id: unknown }).id as Parameters<typeof eq>[0], performerId))
        .limit(1) as unknown as Array<{
          id: number;
          name: string;
          nameEn: string | null;
          profileImageUrl: string | null;
          height: number | null;
          bust: number | null;
          waist: number | null;
          hip: number | null;
          cup: string | null;
          birthday: string | null;
        }>;

      if (performerData.length === 0) {
        return { error: 'Performer not found', status: 404 };
      }

      const performer = performerData[0];
      const limitPerHop = Math.ceil(safeLimit / 2);

      // プロフィールデータがあるかチェック
      const hasProfile = performer.height || performer.bust || performer.cup;

      let hop1Results: Array<{
        id: number;
        name: string;
        nameEn: string | null;
        profileImageUrl: string | null;
        height: number | null;
        bust: number | null;
        waist: number | null;
        hip: number | null;
        cup: string | null;
        birthday: string | null;
        hop: number;
        profile_score: number;
      }> = [];

      if (hasProfile) {
        // 1ホップ目：プロフィール類似（身長、バスト、カップなど）
        const hop1Query = await db.execute(sql`
          SELECT
            p.id,
            p.name,
            p.name_en as "nameEn",
            p.profile_image_url as "profileImageUrl",
            p.height,
            p.bust,
            p.waist,
            p.hip,
            p.cup,
            p.birthday,
            1 as hop,
            -- プロフィール類似度スコア計算
            (
              CASE WHEN ${performer.height}::int IS NOT NULL AND p.height IS NOT NULL
                THEN GREATEST(0, 1.0 - ABS(p.height - ${performer.height}::int) / 20.0)
                ELSE 0 END +
              CASE WHEN ${performer.bust}::int IS NOT NULL AND p.bust IS NOT NULL
                THEN GREATEST(0, 1.0 - ABS(p.bust - ${performer.bust}::int) / 15.0)
                ELSE 0 END +
              CASE WHEN ${performer.waist}::int IS NOT NULL AND p.waist IS NOT NULL
                THEN GREATEST(0, 1.0 - ABS(p.waist - ${performer.waist}::int) / 10.0)
                ELSE 0 END +
              CASE WHEN ${performer.hip}::int IS NOT NULL AND p.hip IS NOT NULL
                THEN GREATEST(0, 1.0 - ABS(p.hip - ${performer.hip}::int) / 15.0)
                ELSE 0 END +
              CASE WHEN ${performer.cup || ''} != '' AND p.cup IS NOT NULL AND p.cup != ''
                THEN CASE
                  WHEN p.cup = ${performer.cup || ''} THEN 1.0
                  WHEN ABS(ASCII(p.cup) - ASCII(${performer.cup || 'A'})) = 1 THEN 0.7
                  WHEN ABS(ASCII(p.cup) - ASCII(${performer.cup || 'A'})) = 2 THEN 0.4
                  ELSE 0 END
                ELSE 0 END
            ) as profile_score
          FROM performers p
          WHERE p.id != ${performerId}
            AND (
              (${performer.height}::int IS NOT NULL AND p.height IS NOT NULL AND ABS(p.height - ${performer.height}::int) <= 10) OR
              (${performer.bust}::int IS NOT NULL AND p.bust IS NOT NULL AND ABS(p.bust - ${performer.bust}::int) <= 10) OR
              (${performer.cup || ''} != '' AND p.cup IS NOT NULL AND p.cup = ${performer.cup || ''})
            )
          ORDER BY profile_score DESC
          LIMIT ${limitPerHop}
        `);
        hop1Results = hop1Query.rows as typeof hop1Results;
      } else {
        // プロフィールがない場合：同じメーカーの作品に多く出演している女優
        const hop1Query = await db.execute(sql`
          WITH target_makers AS (
            SELECT DISTINCT
              SUBSTRING(pr.normalized_product_id FROM '^[A-Z]+') as maker_prefix,
              COUNT(*) as cnt
            FROM product_performers pp
            INNER JOIN products pr ON pp.product_id = pr.id
            WHERE pp.performer_id = ${performerId}
              AND pr.normalized_product_id ~ '^[A-Z]+'
            GROUP BY SUBSTRING(pr.normalized_product_id FROM '^[A-Z]+')
            ORDER BY cnt DESC
            LIMIT 5
          ),
          maker_similar AS (
            SELECT
              pp.performer_id,
              COUNT(DISTINCT pp.product_id) as shared_count
            FROM product_performers pp
            INNER JOIN products pr ON pp.product_id = pr.id
            INNER JOIN target_makers tm ON SUBSTRING(pr.normalized_product_id FROM '^[A-Z]+') = tm.maker_prefix
            WHERE pp.performer_id != ${performerId}
            GROUP BY pp.performer_id
            ORDER BY shared_count DESC
            LIMIT ${limitPerHop}
          )
          SELECT
            p.id,
            p.name,
            p.name_en as "nameEn",
            p.profile_image_url as "profileImageUrl",
            p.height,
            p.bust,
            p.waist,
            p.hip,
            p.cup,
            p.birthday,
            1 as hop,
            ms.shared_count::float / 10.0 as profile_score
          FROM maker_similar ms
          INNER JOIN performers p ON ms.performer_id = p.id
        `);
        hop1Results = hop1Query.rows as typeof hop1Results;
      }

      // 2ホップ目：タグ類似（同じタグ（ジャンル）に多く出演している女優）
      const hop1Ids = hop1Results.map(r => r.id);
      const hop1IdsArray = hop1Ids.length > 0 ? `{${hop1Ids.join(',')}}` : '{0}';

      const hop2Query = await db.execute(sql`
        WITH target_tags AS (
          SELECT DISTINCT pt.tag_id, COUNT(*) as cnt
          FROM product_performers pp
          INNER JOIN product_tags pt ON pp.product_id = pt.product_id
          INNER JOIN tags t ON pt.tag_id = t.id
          WHERE pp.performer_id = ${performerId}
            AND t.category = 'genre'
          GROUP BY pt.tag_id
          ORDER BY cnt DESC
          LIMIT 10
        ),
        tag_similar AS (
          SELECT
            pp.performer_id,
            COUNT(DISTINCT pt.tag_id) as shared_tags,
            SUM(tt.cnt) as tag_weight
          FROM product_performers pp
          INNER JOIN product_tags pt ON pp.product_id = pt.product_id
          INNER JOIN target_tags tt ON pt.tag_id = tt.tag_id
          WHERE pp.performer_id != ${performerId}
            AND pp.performer_id != ALL(${hop1IdsArray}::int[])
          GROUP BY pp.performer_id
          HAVING COUNT(DISTINCT pt.tag_id) >= 3
          ORDER BY shared_tags DESC, tag_weight DESC
          LIMIT ${limitPerHop}
        )
        SELECT
          p.id,
          p.name,
          p.name_en as "nameEn",
          p.profile_image_url as "profileImageUrl",
          p.height,
          p.bust,
          p.waist,
          p.hip,
          p.cup,
          p.birthday,
          2 as hop,
          ts.shared_tags as shared_genres
        FROM tag_similar ts
        INNER JOIN performers p ON ts.performer_id = p.id
      `);

      const hop2Results = hop2Query.rows as Array<{
        id: number;
        name: string;
        nameEn: string | null;
        profileImageUrl: string | null;
        height: number | null;
        bust: number | null;
        waist: number | null;
        hip: number | null;
        cup: string | null;
        birthday: string | null;
        hop: number;
        shared_genres: number;
      }>;

      // プロフィール類似度を計算
      const calculateProfileSimilarity = (other: { height: number | null; bust: number | null; waist: number | null; hip: number | null; cup: string | null }) => {
        let heightSim = 0;
        let bustSim = 0;
        let waistSim = 0;
        let hipSim = 0;
        let cupSim = 0;

        if (performer.height && other.height) {
          heightSim = Math.max(0, 1 - Math.abs(performer.height - other.height) / 20);
        }
        if (performer.bust && other.bust) {
          bustSim = Math.max(0, 1 - Math.abs(performer.bust - other.bust) / 15);
        }
        if (performer.waist && other.waist) {
          waistSim = Math.max(0, 1 - Math.abs(performer.waist - other.waist) / 10);
        }
        if (performer.hip && other.hip) {
          hipSim = Math.max(0, 1 - Math.abs(performer.hip - other.hip) / 15);
        }
        if (performer.cup && other.cup) {
          const cupDiff = Math.abs(performer.cup.charCodeAt(0) - other.cup.charCodeAt(0));
          if (cupDiff === 0) cupSim = 1.0;
          else if (cupDiff === 1) cupSim = 0.7;
          else if (cupDiff === 2) cupSim = 0.4;
        }

        return { heightSim, bustSim, waistSim, hipSim, cupSim };
      };

      // サムネイル取得
      const allResults = [...hop1Results, ...hop2Results];
      const performerIds = allResults.map(r => r.id);
      const thumbnailMap = new Map<number, string | null>();

      if (performerIds.length > 0) {
        const performerIdsArray = `{${performerIds.join(',')}}`;
        const thumbnailQuery = isFanza
          ? await db.execute(sql`
              SELECT DISTINCT ON (pp.performer_id)
                pp.performer_id,
                p.default_thumbnail_url as thumbnail_url
              FROM product_performers pp
              INNER JOIN products p ON pp.product_id = p.id
              INNER JOIN product_sources ps ON p.id = ps.product_id
              WHERE pp.performer_id = ANY(${performerIdsArray}::int[])
                AND p.default_thumbnail_url IS NOT NULL
                AND ps.asp_name = 'FANZA'
              ORDER BY pp.performer_id, p.release_date DESC NULLS LAST
            `)
          : await db.execute(sql`
              SELECT DISTINCT ON (pp.performer_id)
                pp.performer_id,
                COALESCE(
                  (SELECT pi.image_url FROM product_images pi
                   WHERE pi.product_id = p.id
                     AND pi.image_type = 'thumbnail'
                     AND pi.asp_name IS NOT NULL
                     AND pi.asp_name != 'FANZA'
                   ORDER BY pi.display_order NULLS LAST
                   LIMIT 1),
                  p.default_thumbnail_url
                ) as thumbnail_url
              FROM product_performers pp
              INNER JOIN products p ON pp.product_id = p.id
              WHERE pp.performer_id = ANY(${performerIdsArray}::int[])
                AND p.default_thumbnail_url IS NOT NULL
              ORDER BY pp.performer_id, p.release_date DESC NULLS LAST
            `);

        for (const row of thumbnailQuery.rows as Array<{ performer_id: number; thumbnail_url: string }>) {
          thumbnailMap.set(row.performer_id, row.thumbnail_url);
        }
      }

      // スコア計算
      const similarPerformers: SimilarPerformer[] = [];

      // 1ホップ目：プロフィール類似 or メーカー類似
      for (const r of hop1Results) {
        let finalScore: number;
        const reasons: string[] = [];

        if (hasProfile) {
          // プロフィール類似の場合
          const { heightSim, bustSim, waistSim, hipSim, cupSim } = calculateProfileSimilarity(r);
          const profileComponents = [heightSim, bustSim, waistSim, hipSim, cupSim];
          const validProfileComponents = profileComponents.filter(c => c > 0);
          finalScore = validProfileComponents.length > 0
            ? validProfileComponents.reduce((a, b) => a + b, 0) / validProfileComponents.length
            : 0;

          // 類似度0.3以上のみ
          if (finalScore < 0.3) continue;

          if (heightSim >= 0.7) reasons.push('似た身長');
          if (bustSim >= 0.7 || cupSim >= 0.7) reasons.push('似たバスト');
          if (waistSim >= 0.7 && hipSim >= 0.7) reasons.push('似たスタイル');
          if (reasons.length === 0) reasons.push('プロフィール類似');
        } else {
          // メーカー類似の場合
          finalScore = Math.min(1.0, Math.max(0.4, r.profile_score));
          reasons.push('同じメーカー');
        }

        similarPerformers.push({
          id: r.id,
          name: r.name,
          nameEn: r.nameEn,
          profileImageUrl: r.profileImageUrl,
          thumbnailUrl: thumbnailMap.get(r.id) || null,
          similarityScore: finalScore,
          similarityReasons: reasons,
          genreScore: 0,
          makerScore: hasProfile ? 0 : finalScore,
          profileScore: hasProfile ? finalScore : 0,
          hop: 1,
        });
      }

      // 2ホップ目：ジャンル類似
      const maxSharedGenres = hop2Results.length > 0 ? Math.max(...hop2Results.map(r => r.shared_genres)) : 1;
      for (let i = 0; i < hop2Results.length; i++) {
        const r = hop2Results[i];
        // ジャンル共通数をスコアに変換（0.4-0.8の範囲）
        const genreScore = 0.4 + 0.4 * (r.shared_genres / maxSharedGenres);

        similarPerformers.push({
          id: r.id,
          name: r.name,
          nameEn: r.nameEn,
          profileImageUrl: r.profileImageUrl,
          thumbnailUrl: thumbnailMap.get(r.id) || null,
          similarityScore: genreScore,
          similarityReasons: [`共通ジャンル${r.shared_genres}個`],
          genreScore,
          makerScore: 0,
          profileScore: 0,
          hop: 2,
        });
      }

      // ホップでソート、同じホップ内はスコアでソート
      similarPerformers.sort((a, b) => {
        if (a.hop !== b.hop) return a.hop - b.hop;
        return b.similarityScore - a.similarityScore;
      });

      const finalResults = similarPerformers.slice(0, safeLimit);

      const totalSimilarCount = finalResults.length;
      const avgSimilarityScore = totalSimilarCount > 0
        ? finalResults.reduce((sum, p) => sum + p.similarityScore, 0) / totalSimilarCount
        : 0;

      // 中心女優のサムネイル取得
      let centerThumbnail: string | null = null;
      const centerThumbQuery = isFanza
        ? await db.execute(sql`
            SELECT p.default_thumbnail_url as thumbnail_url
            FROM products p
            INNER JOIN product_performers pp ON p.id = pp.product_id
            INNER JOIN product_sources ps ON p.id = ps.product_id
            WHERE pp.performer_id = ${performerId}
              AND LOWER(ps.asp_name) = 'fanza'
            ORDER BY p.release_date DESC NULLS LAST
            LIMIT 1
          `)
        : await db.execute(sql`
            SELECT COALESCE(
              (SELECT pi.image_url FROM product_images pi
               INNER JOIN product_performers pp ON pi.product_id = pp.product_id
               WHERE pp.performer_id = ${performerId}
                 AND pi.image_type = 'thumbnail'
                 AND pi.asp_name IS NOT NULL
                 AND pi.asp_name != 'FANZA'
               LIMIT 1),
              (SELECT p.default_thumbnail_url FROM products p
               INNER JOIN product_performers pp ON p.id = pp.product_id
               WHERE pp.performer_id = ${performerId}
               ORDER BY p.release_date DESC NULLS LAST
               LIMIT 1)
            ) as thumbnail_url
          `);
      centerThumbnail = (centerThumbQuery.rows[0] as { thumbnail_url: string | null })?.thumbnail_url || null;

      // エッジを生成（中心から各ノードへ、類似度ベース）
      const edges: NetworkEdge[] = finalResults.map(p => ({
        source: performerId,
        target: p.id,
        weight: Math.round(p.similarityScore * 100),
      }));

      const response: PerformerSimilarityResponse = {
        success: true,
        performer: {
          id: performer.id,
          name: performer.name,
          nameEn: performer.nameEn,
          profileImageUrl: performer.profileImageUrl,
          thumbnailUrl: centerThumbnail,
        },
        similar: finalResults,
        edges,
        stats: {
          totalSimilarCount,
          avgSimilarityScore,
        },
      };

      await setCache(cacheKey, response, CACHE_TTL);

      return { data: response, status: 200 };

    } catch (error) {
      console.error('[Performer Similar API] Error:', error);
      return { error: 'Internal server error', status: 500 };
    }
  };
}
