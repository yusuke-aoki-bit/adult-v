/**
 * 女優バッチ取得関数
 * 両アプリ（web/fanza）で共通使用
 */

import { eq, desc, inArray, sql } from 'drizzle-orm';

// ============================================================
// Types
// ============================================================

export interface BatchPerformerQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performerAliases: any;
  /** DTIサービス判別関数 */
  getDtiServiceFromUrl: (url: string) => string | null;
}

// ============================================================
// Factory
// ============================================================

/**
 * 女優バッチ取得クエリファクトリー
 */
export function createBatchPerformerQueries(deps: BatchPerformerQueryDeps) {
  const {
    getDb,
    products,
    productPerformers,
    productSources,
    performerAliases,
    getDtiServiceFromUrl,
  } = deps;

  /**
   * バッチで複数女優のサムネイル画像を取得（最新作品のサムネイルを使用）
   * DISTINCT ON を使用して各女優につき1件だけ取得（ROW_NUMBERより高速）
   */
  async function batchGetPerformerThumbnails(performerIds: number[]): Promise<Map<number, string>> {
    if (performerIds.length === 0) return new Map();

    const db = getDb();

    // 各女優のサムネイルURLを取得（DTI以外を優先、各女優につき1件のみ）
    // DISTINCT ON を使用（PostgreSQL固有だがROW_NUMBER()より高速）
    const results = await db.execute(sql`
      SELECT DISTINCT ON (pp.performer_id)
        pp.performer_id,
        p.default_thumbnail_url as thumbnail_url
      FROM product_performers pp
      INNER JOIN products p ON pp.product_id = p.id
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id IN (${sql.join(performerIds.map(id => sql`${id}`), sql`, `)})
        AND p.default_thumbnail_url IS NOT NULL
        AND p.default_thumbnail_url != ''
      ORDER BY
        pp.performer_id,
        CASE WHEN ps.asp_name != 'DTI' THEN 0 ELSE 1 END,
        p.created_at DESC
    `);

    const map = new Map<number, string>();
    for (const r of results.rows as Array<{ performer_id: number; thumbnail_url: string }>) {
      if (r.thumbnail_url) {
        map.set(r.performer_id, r.thumbnail_url);
      }
    }
    return map;
  }

  /**
   * バッチで複数女優のASPサービス一覧を取得
   * DTI系サービスはサムネイルURLからサービスを判別して個別に分類
   */
  async function batchGetPerformerServices(performerIds: number[]): Promise<Map<number, string[]>> {
    if (performerIds.length === 0) return new Map();

    const db = getDb();

    // DTI系の場合はサムネイルURLも取得してサービスを判別
    const results = await db
      .selectDistinct({
        performerId: productPerformers.performerId,
        aspName: productSources.aspName,
        thumbnailUrl: products.defaultThumbnailUrl,
      })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(inArray(productPerformers.performerId, performerIds));

    const map = new Map<number, string[]>();
    for (const r of results) {
      if (!r.aspName) continue;

      let serviceName = r.aspName;

      // DTI系の場合、サムネイルURLからサービスを判別
      if (r.aspName.toUpperCase() === 'DTI' && r.thumbnailUrl) {
        const dtiService = getDtiServiceFromUrl(r.thumbnailUrl);
        if (dtiService) {
          serviceName = dtiService;
        } else {
          // サービス判別できない場合は小文字の'dti'
          serviceName = 'dti';
        }
      } else {
        // DTI以外は小文字に正規化
        serviceName = r.aspName.toLowerCase();
      }

      const services = map.get(r.performerId) || [];
      if (!services.includes(serviceName)) {
        services.push(serviceName);
        map.set(r.performerId, services);
      }
    }
    return map;
  }

  /**
   * バッチで複数女優の別名を取得
   */
  async function batchGetPerformerAliases(performerIds: number[]): Promise<Map<number, string[]>> {
    if (performerIds.length === 0) return new Map();

    const db = getDb();

    const results = await db
      .select({
        performerId: performerAliases.performerId,
        aliasName: performerAliases.aliasName,
        isPrimary: performerAliases.isPrimary,
      })
      .from(performerAliases)
      .where(inArray(performerAliases.performerId, performerIds))
      .orderBy(performerAliases.performerId, desc(performerAliases.isPrimary));

    const map = new Map<number, string[]>();
    for (const r of results) {
      if (!r.aliasName || r.isPrimary) continue; // 主名は除外（既にnameに含まれる）
      const aliases = map.get(r.performerId) || [];
      if (!aliases.includes(r.aliasName)) {
        aliases.push(r.aliasName);
        map.set(r.performerId, aliases);
      }
    }
    return map;
  }

  return {
    batchGetPerformerThumbnails,
    batchGetPerformerServices,
    batchGetPerformerAliases,
  };
}

export type BatchPerformerQueries = ReturnType<typeof createBatchPerformerQueries>;
