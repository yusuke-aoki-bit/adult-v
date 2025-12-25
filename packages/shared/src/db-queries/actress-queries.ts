/**
 * 共有女優DBクエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, sql, inArray, desc, asc } from 'drizzle-orm';

// ============================================================
// Types
// ============================================================

export interface ActressQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performerAliases: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  /** Function to map DB performer to ActressType */
  mapPerformerToActress: (performer: unknown, locale: string) => unknown;
  /** Function to get localized performer name */
  getLocalizedPerformerName?: (performer: unknown, locale: string) => string;
}

export interface PerformerAlias {
  id: number;
  aliasName: string;
  source: string | null;
}

export interface SiteProductCount {
  site: string;
  count: number;
}

export interface AspProductCount {
  aspName: string;
  count: number;
}

// ============================================================
// Factory
// ============================================================

/**
 * 女優クエリファクトリー
 */
export function createActressQueries(deps: ActressQueryDeps) {
  const {
    getDb,
    performers,
    performerAliases,
    productPerformers,
    productSources,
    mapPerformerToActress,
  } = deps;

  /**
   * 女優IDで女優を取得
   */
  async function getActressById<T>(id: string, locale: string = 'ja'): Promise<T | null> {
    try {
      const db = getDb();

      const result = await db
        .select()
        .from(performers)
        .where(eq(performers.id, parseInt(id)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return mapPerformerToActress(result[0], locale) as T;
    } catch (error) {
      console.error(`Error fetching actress ${id}:`, error);
      throw error;
    }
  }

  /**
   * 演者の別名を取得
   */
  async function getPerformerAliases(performerId: number): Promise<PerformerAlias[]> {
    const db = getDb();

    const aliases = await db
      .select({
        id: performerAliases.id,
        aliasName: performerAliases.aliasName,
        source: performerAliases.source,
      })
      .from(performerAliases)
      .where(eq(performerAliases.performerId, performerId));

    return aliases;
  }

  /**
   * 女優の出演作品数をサイト別に取得
   */
  async function getActressProductCountBySite(actressId: string): Promise<SiteProductCount[]> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN ps.asp_name IN ('CARIBBEAN', 'CARIBBEANCOMPR', '1PONDO', 'HEYZO', '10MUSUME',
                               'PACOPACOMAMA', 'H4610', 'H0930', 'C0930', 'GACHINCO',
                               'KIN8TENGOKU', 'NYOSHIN', 'HEYDOUGA', 'X1X', 'ENKOU55',
                               'UREKKO', 'XXXURABI', 'TOKYOHOT') THEN 'dti'
          WHEN ps.asp_name = 'DUGA' THEN 'duga'
          WHEN ps.asp_name = 'SOKMIL' THEN 'sokmil'
          WHEN ps.asp_name = 'MGS' THEN 'mgs'
          WHEN ps.asp_name = 'FANZA' THEN 'fanza'
          WHEN ps.asp_name = 'FC2' THEN 'fc2'
          ELSE 'other'
        END as site,
        COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
      GROUP BY site
      ORDER BY count DESC
    `);

    return (result.rows as { site: string; count: string | number }[]).map((row) => ({
      site: row.site,
      count: typeof row.count === 'string' ? parseInt(row.count) : row.count,
    }));
  }

  /**
   * 女優の出演作品数をASP別に取得
   */
  async function getActressProductCountByAsp(actressId: string): Promise<AspProductCount[]> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        ps.asp_name as "aspName",
        COUNT(DISTINCT pp.product_id) as count
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
      GROUP BY ps.asp_name
      ORDER BY count DESC
    `);

    return (result.rows as { aspName: string; count: string | number }[]).map((row) => ({
      aspName: row.aspName,
      count: typeof row.count === 'string' ? parseInt(row.count) : row.count,
    }));
  }

  /**
   * 女優の平均価格/分を取得
   */
  async function getActressAvgPricePerMin(actressId: string): Promise<number | null> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        AVG(ps.price / NULLIF(p.duration, 0)) as avg_price_per_min
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${parseInt(actressId)}
        AND ps.price IS NOT NULL
        AND ps.price > 0
        AND p.duration IS NOT NULL
        AND p.duration > 0
    `);

    if (result.rows.length === 0) return null;

    const avgPricePerMin = (result.rows[0] as { avg_price_per_min: string | number | null })
      .avg_price_per_min;

    if (avgPricePerMin === null) return null;

    return typeof avgPricePerMin === 'string'
      ? parseFloat(avgPricePerMin)
      : avgPricePerMin;
  }

  return {
    getActressById,
    getPerformerAliases,
    getActressProductCountBySite,
    getActressProductCountByAsp,
    getActressAvgPricePerMin,
  };
}

export type ActressQueries = ReturnType<typeof createActressQueries>;
