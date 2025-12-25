/**
 * コア商品/女優クエリ
 * apps/web と apps/fanza で共通利用される主要クエリ
 * 依存性注入パターンでDBとスキーマを外部から受け取る
 */
import { eq, and, sql, inArray, desc, asc, SQL, or, ilike } from 'drizzle-orm';

// ============================================================
// Types
// ============================================================

export interface CoreQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productTags: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productImages: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productVideos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSales: any;
  /** サイトモード ('all' | 'fanza-only') */
  siteMode: 'all' | 'fanza-only';
}

export interface TagResult {
  id: number;
  name: string;
  category: string | null;
}

export interface ProviderProductCount {
  provider: string;
  count: number;
}

export interface SaleStatsResult {
  totalSaleProducts: number;
  avgDiscountPercent: number;
  maxDiscountPercent: number;
  saleEndingSoon: number;
}

// ============================================================
// Factory
// ============================================================

/**
 * コアクエリファクトリー
 */
export function createCoreQueries(deps: CoreQueryDeps) {
  const {
    getDb,
    products,
    performers,
    productPerformers,
    tags,
    productTags,
    productSources,
    productImages,
    productVideos,
    productSales,
    siteMode,
  } = deps;

  /**
   * ASPフィルタ条件を生成
   */
  function getAspFilterCondition(): SQL {
    if (siteMode === 'fanza-only') {
      return sql`EXISTS (
        SELECT 1 FROM ${productSources} ps_fanza
        WHERE ps_fanza.product_id = ${products.id}
        AND ps_fanza.asp_name = 'FANZA'
      )`;
    }

    // adult-v: FANZA専用商品を除外
    return sql`(EXISTS (
      SELECT 1 FROM ${productSources} ps_check
      WHERE ps_check.product_id = ${products.id}
      AND ps_check.asp_name != 'FANZA'
    ) OR NOT EXISTS (
      SELECT 1 FROM ${productSources} ps_fanza
      WHERE ps_fanza.product_id = ${products.id}
      AND ps_fanza.asp_name = 'FANZA'
    ))`;
  }

  /**
   * タグ一覧を取得
   */
  async function getTags(category?: string): Promise<TagResult[]> {
    const db = getDb();

    let query = db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags);

    if (category) {
      query = query.where(eq(tags.category, category));
    }

    return query.orderBy(asc(tags.name));
  }

  /**
   * タグIDでタグを取得
   */
  async function getTagById(tagId: number): Promise<TagResult | null> {
    const db = getDb();

    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * プロバイダー別商品数を取得
   */
  async function getProviderProductCounts(): Promise<Record<string, number>> {
    const db = getDb();

    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN ps.asp_name IN ('CARIBBEAN', 'CARIBBEANCOMPR', '1PONDO', 'HEYZO', '10MUSUME',
                               'PACOPACOMAMA', 'H4610', 'H0930', 'C0930', 'GACHINCO',
                               'KIN8TENGOKU', 'NYOSHIN', 'HEYDOUGA', 'X1X', 'ENKOU55',
                               'UREKKO', 'XXXURABI', 'TOKYOHOT', 'DTI') THEN 'dti'
          WHEN ps.asp_name = 'DUGA' OR ps.asp_name = 'APEX' THEN 'duga'
          WHEN ps.asp_name = 'SOKMIL' THEN 'sokmil'
          WHEN ps.asp_name = 'MGS' THEN 'mgs'
          WHEN ps.asp_name = 'FANZA' THEN 'fanza'
          WHEN ps.asp_name = 'FC2' THEN 'fc2'
          WHEN ps.asp_name = 'B10F' THEN 'b10f'
          ELSE 'other'
        END as provider,
        COUNT(DISTINCT ps.product_id) as count
      FROM ${productSources} ps
      GROUP BY provider
      ORDER BY count DESC
    `);

    const counts: Record<string, number> = {};
    for (const row of result.rows as { provider: string; count: string | number }[]) {
      counts[row.provider] = typeof row.count === 'string' ? parseInt(row.count) : row.count;
    }
    return counts;
  }

  /**
   * セール統計を取得
   */
  async function getSaleStats(aspName?: string): Promise<SaleStatsResult> {
    const db = getDb();

    const aspCondition = aspName
      ? sql`AND ps.asp_name = ${aspName}`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT psl.product_source_id) as "totalSaleProducts",
        AVG(psl.discount_percent) as "avgDiscountPercent",
        MAX(psl.discount_percent) as "maxDiscountPercent",
        COUNT(DISTINCT CASE
          WHEN psl.end_at IS NOT NULL AND psl.end_at < NOW() + INTERVAL '3 days'
          THEN psl.product_source_id
        END) as "saleEndingSoon"
      FROM ${productSales} psl
      INNER JOIN ${productSources} ps ON psl.product_source_id = ps.id
      WHERE psl.is_active = TRUE
      ${aspCondition}
    `);

    if (result.rows.length === 0) {
      return {
        totalSaleProducts: 0,
        avgDiscountPercent: 0,
        maxDiscountPercent: 0,
        saleEndingSoon: 0,
      };
    }

    const row = result.rows[0] as {
      totalSaleProducts: string | number;
      avgDiscountPercent: string | number | null;
      maxDiscountPercent: string | number | null;
      saleEndingSoon: string | number;
    };

    return {
      totalSaleProducts:
        typeof row.totalSaleProducts === 'string'
          ? parseInt(row.totalSaleProducts)
          : row.totalSaleProducts || 0,
      avgDiscountPercent:
        typeof row.avgDiscountPercent === 'string'
          ? parseFloat(row.avgDiscountPercent)
          : row.avgDiscountPercent || 0,
      maxDiscountPercent:
        typeof row.maxDiscountPercent === 'string'
          ? parseInt(row.maxDiscountPercent)
          : row.maxDiscountPercent || 0,
      saleEndingSoon:
        typeof row.saleEndingSoon === 'string'
          ? parseInt(row.saleEndingSoon)
          : row.saleEndingSoon || 0,
    };
  }

  /**
   * 人気タグを取得
   */
  async function getPopularTags(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<Array<TagResult & { productCount: number }>> {
    const db = getDb();
    const { limit = 20, category } = options;

    const categoryCondition = category
      ? sql`AND t.category = ${category}`
      : sql``;

    const aspFilter = getAspFilterCondition();

    const result = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        t.category,
        COUNT(DISTINCT pt.product_id) as "productCount"
      FROM ${tags} t
      INNER JOIN ${productTags} pt ON t.id = pt.tag_id
      INNER JOIN ${products} p ON pt.product_id = p.id
      WHERE ${aspFilter}
      ${categoryCondition}
      GROUP BY t.id, t.name, t.category
      ORDER BY "productCount" DESC
      LIMIT ${limit}
    `);

    return (result.rows as Array<{
      id: number;
      name: string;
      category: string | null;
      productCount: string | number;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      productCount:
        typeof row.productCount === 'string'
          ? parseInt(row.productCount)
          : row.productCount,
    }));
  }

  /**
   * あいまい検索用のクエリを実行
   */
  async function fuzzySearchQuery(
    searchTerm: string,
    table: 'products' | 'performers',
    limit: number = 20
  ): Promise<number[]> {
    const db = getDb();

    if (table === 'products') {
      const result = await db
        .select({ id: products.id })
        .from(products)
        .where(
          or(
            ilike(products.title, `%${searchTerm}%`),
            ilike(products.normalizedProductId, `%${searchTerm}%`),
            ilike(products.description, `%${searchTerm}%`)
          )
        )
        .limit(limit);
      return result.map((r: { id: number }) => r.id);
    }

    const result = await db
      .select({ id: performers.id })
      .from(performers)
      .where(
        or(
          ilike(performers.name, `%${searchTerm}%`),
          ilike(performers.nameKana, `%${searchTerm}%`)
        )
      )
      .limit(limit);
    return result.map((r: { id: number }) => r.id);
  }

  return {
    getAspFilterCondition,
    getTags,
    getTagById,
    getProviderProductCounts,
    getSaleStats,
    getPopularTags,
    fuzzySearchQuery,
  };
}

export type CoreQueries = ReturnType<typeof createCoreQueries>;
