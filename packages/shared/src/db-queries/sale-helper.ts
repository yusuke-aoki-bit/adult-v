/**
 * セール情報保存ヘルパー
 * 依存性注入パターンでDBを外部から受け取る
 */

import { sql as drizzleSql, eq, and, desc, inArray, gte } from 'drizzle-orm';
import { logDbErrorAndReturn } from '../lib/db-logger';

export interface SaleInfo {
  regularPrice: number;
  salePrice: number;
  discountPercent?: number;
  saleName?: string;
  saleType?: string; // 'timesale', 'campaign', 'clearance' など
  endAt?: Date | null;
}

/**
 * セール商品の型
 */
export interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: Date | null;
  performers: Array<{ id: number; name: string }>;
}

/**
 * 既存のセール保存ヘルパー用依存性（後方互換用）
 */
export interface SaleHelperDeps {
  getDb: () => {
    execute: (query: ReturnType<typeof drizzleSql>) => Promise<{ rows: unknown[] }>;
  };
}

/**
 * セールクエリ用依存性（getSaleProducts用）
 */
// Note: DI型でanyを使用するのは意図的 - Drizzle ORMの具象型はアプリ固有のため
export interface SaleQueryDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSources: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSales: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productPerformers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performers: any;
  /** サイトモード（キャッシュキー接頭辞に使用） */
  siteMode: 'all' | 'fanza-only';
  /** メモリキャッシュ取得関数 */
  getFromMemoryCache: <T>(key: string) => T | null;
  /** メモリキャッシュ保存関数 */
  setToMemoryCache: <T>(key: string, data: T) => void;
}

export interface SaleHelperQueries {
  saveSaleInfo: (
    aspName: string,
    originalProductId: string,
    saleInfo: SaleInfo
  ) => Promise<boolean>;
  deactivateSale: (aspName: string, originalProductId: string) => Promise<void>;
  deactivateExpiredSales: () => Promise<number>;
}

/**
 * セール統計結果（ASP別統計）
 */
export interface SaleStatsWithAspResult {
  totalSales: number;
  byAsp: Array<{ aspName: string; count: number; avgDiscount: number }>;
}

export interface SaleQueryQueries {
  getSaleProducts: (options?: {
    limit?: number;
    aspName?: string;
    minDiscount?: number;
  }) => Promise<SaleProduct[]>;
  getSaleStats: (aspName?: string) => Promise<SaleStatsWithAspResult>;
}

/**
 * セールヘルパークエリを生成
 */
export function createSaleHelperQueries(deps: SaleHelperDeps): SaleHelperQueries {
  const { getDb } = deps;

  /**
   * セール情報を保存または更新
   */
  async function saveSaleInfo(
    aspName: string,
    originalProductId: string,
    saleInfo: SaleInfo
  ): Promise<boolean> {
    const db = getDb();

    try {
      // セール価格が通常価格以上なら保存しない
      if (saleInfo.salePrice >= saleInfo.regularPrice) {
        return false;
      }

      // 割引率を計算
      const discountPercent =
        saleInfo.discountPercent ||
        Math.round((1 - saleInfo.salePrice / saleInfo.regularPrice) * 100);

      // product_sourceを検索
      const sourceResult = await db.execute(drizzleSql`
        SELECT id FROM product_sources
        WHERE asp_name = ${aspName}
        AND original_product_id = ${originalProductId}
        LIMIT 1
      `);

      if (sourceResult.rows.length === 0) {
        // 商品が未登録の場合はスキップ
        return false;
      }

      const productSourceId = (sourceResult.rows[0] as { id: number }).id;

      // 既存のアクティブなセールをチェック
      const existingSale = await db.execute(drizzleSql`
        SELECT id, sale_price, discount_percent
        FROM product_sales
        WHERE product_source_id = ${productSourceId}
        AND is_active = TRUE
        LIMIT 1
      `);

      if (existingSale.rows.length > 0) {
        const existing = existingSale.rows[0] as {
          id: number;
          sale_price: number;
          discount_percent: number | null;
        };
        // 価格が同じなら更新不要
        if (existing.sale_price === saleInfo.salePrice) {
          // fetched_atだけ更新
          await db.execute(drizzleSql`
            UPDATE product_sales
            SET fetched_at = NOW()
            WHERE id = ${existing.id}
          `);
          return true;
        }

        // 価格が変わった場合は既存を非アクティブにして新規作成
        await db.execute(drizzleSql`
          UPDATE product_sales
          SET is_active = FALSE, updated_at = NOW()
          WHERE id = ${existing.id}
        `);
      }

      // 新しいセール情報を挿入
      await db.execute(drizzleSql`
        INSERT INTO product_sales (
          product_source_id,
          regular_price,
          sale_price,
          discount_percent,
          sale_name,
          sale_type,
          end_at,
          is_active,
          fetched_at
        ) VALUES (
          ${productSourceId},
          ${saleInfo.regularPrice},
          ${saleInfo.salePrice},
          ${discountPercent},
          ${saleInfo.saleName || null},
          ${saleInfo.saleType || null},
          ${saleInfo.endAt || null},
          TRUE,
          NOW()
        )
      `);

      return true;
    } catch (error) {
      return logDbErrorAndReturn(error, false, 'saveSaleInfo', { aspName, originalProductId });
    }
  }

  /**
   * セールが終了した商品を非アクティブに
   */
  async function deactivateSale(
    aspName: string,
    originalProductId: string
  ): Promise<void> {
    const db = getDb();

    try {
      await db.execute(drizzleSql`
        UPDATE product_sales ps
        SET is_active = FALSE, updated_at = NOW()
        FROM product_sources src
        WHERE ps.product_source_id = src.id
        AND src.asp_name = ${aspName}
        AND src.original_product_id = ${originalProductId}
        AND ps.is_active = TRUE
      `);
    } catch (error) {
      logDbErrorAndReturn(error, undefined, 'deactivateSale', { aspName, originalProductId });
    }
  }

  /**
   * 期限切れのセールを一括で非アクティブに
   */
  async function deactivateExpiredSales(): Promise<number> {
    const db = getDb();

    const result = await db.execute(drizzleSql`
      UPDATE product_sales
      SET is_active = FALSE, updated_at = NOW()
      WHERE is_active = TRUE
      AND end_at IS NOT NULL
      AND end_at < NOW()
      RETURNING id
    `);

    return result.rows.length;
  }

  return {
    saveSaleInfo,
    deactivateSale,
    deactivateExpiredSales,
  };
}

/**
 * セールクエリを生成（getSaleProducts用）
 */
export function createSaleQueries(deps: SaleQueryDeps): SaleQueryQueries {
  const {
    getDb,
    products,
    productSources,
    productSales,
    productPerformers,
    performers,
    siteMode,
    getFromMemoryCache,
    setToMemoryCache,
  } = deps;

  /**
   * セール中の商品を取得
   * ASP優先順位: MGS > DUGA > SOKMIL > FANZA
   */
  async function getSaleProducts(options?: {
    limit?: number;
    aspName?: string;
    minDiscount?: number;
  }): Promise<SaleProduct[]> {
    try {
      const db = getDb();
      const limit = options?.limit || 20;

      // キャッシュキー生成（siteModeに応じてプレフィックスを変更）
      const cachePrefix = siteMode === 'fanza-only' ? 'saleProducts:fanza' : 'saleProducts';
      const cacheKey = `${cachePrefix}:${limit}:${options?.aspName || ''}:${options?.minDiscount || 0}`;
      const cached = getFromMemoryCache<SaleProduct[]>(cacheKey);
      if (cached) return cached;

      const conditions = [
        eq(productSales.isActive, true),
        drizzleSql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`,
      ];

      if (options?.aspName) {
        conditions.push(eq(productSources.aspName, options.aspName));
      }

      if (options?.minDiscount) {
        conditions.push(gte(productSales.discountPercent, options.minDiscount));
      }

      // ASP優先順位でソート（MGS優先）
      const aspPriorityOrder = drizzleSql`CASE
        WHEN ${productSources.aspName} = 'MGS' THEN 1
        WHEN ${productSources.aspName} = 'DUGA' THEN 2
        WHEN ${productSources.aspName} = 'SOKMIL' THEN 3
        WHEN ${productSources.aspName} = 'FANZA' THEN 4
        ELSE 5
      END`;

      const results = await db
        .select({
          productId: products.id,
          normalizedProductId: products.normalizedProductId,
          title: products.title,
          thumbnailUrl: products.defaultThumbnailUrl,
          aspName: productSources.aspName,
          affiliateUrl: productSources.affiliateUrl,
          regularPrice: productSales.regularPrice,
          salePrice: productSales.salePrice,
          discountPercent: productSales.discountPercent,
          saleName: productSales.saleName,
          saleType: productSales.saleType,
          endAt: productSales.endAt,
        })
        .from(productSales)
        .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
        .innerJoin(products, eq(productSources.productId, products.id))
        .where(and(...conditions))
        .orderBy(aspPriorityOrder, desc(productSales.discountPercent), desc(productSales.fetchedAt))
        .limit(limit);

      // 出演者情報を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedResults = results as any[];
      const productIds = typedResults.map((r) => r.productId as number);
      const rawPerformerData = productIds.length > 0
        ? await db
            .select({
              productId: productPerformers.productId,
              performerId: performers.id,
              performerName: performers.name,
            })
            .from(productPerformers)
            .innerJoin(performers, eq(productPerformers.performerId, performers.id))
            .where(inArray(productPerformers.productId, productIds))
        : [];

      // 商品IDごとに出演者をグループ化
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedPerformerData = rawPerformerData as any[];
      const performersByProduct = new Map<number, Array<{ id: number; name: string }>>();
      for (const p of typedPerformerData) {
        const productId = p.productId as number;
        const arr = performersByProduct.get(productId) || [];
        arr.push({ id: p.performerId as number, name: p.performerName as string });
        performersByProduct.set(productId, arr);
      }

      const saleProducts: SaleProduct[] = typedResults.map((r: any) => ({
        productId: r.productId as number,
        normalizedProductId: r.normalizedProductId as string | null,
        title: r.title as string,
        thumbnailUrl: r.thumbnailUrl as string | null,
        aspName: r.aspName as string,
        affiliateUrl: r.affiliateUrl as string | null,
        regularPrice: r.regularPrice as number,
        salePrice: r.salePrice as number,
        discountPercent: (r.discountPercent as number | null) || 0,
        saleName: r.saleName as string | null,
        saleType: r.saleType as string | null,
        endAt: r.endAt as Date | null,
        performers: performersByProduct.get(r.productId as number) || [],
      }));

      // キャッシュに保存
      setToMemoryCache(cacheKey, saleProducts);
      return saleProducts;
    } catch (error) {
      return logDbErrorAndReturn(error, [], 'getSaleProducts');
    }
  }

  /**
   * セール統計を取得
   */
  async function getSaleStats(aspName?: string): Promise<SaleStatsWithAspResult> {
    try {
      const db = getDb();

      // ベース条件
      const baseConditions = [
        eq(productSales.isActive, true),
        drizzleSql`(${productSales.endAt} IS NULL OR ${productSales.endAt} > NOW())`,
      ];

      if (aspName) {
        // ASPフィルターがある場合はJOINして絞り込む
        const totalResult = await db
          .select({ count: drizzleSql<number>`count(*)` })
          .from(productSales)
          .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
          .where(and(
            ...baseConditions,
            eq(productSources.aspName, aspName)
          ));

        const total = Number(totalResult[0]?.count || 0);

        // ASP別統計（フィルタあり）
        const byAspResult = await db
          .select({
            aspName: productSources.aspName,
            count: drizzleSql<number>`count(*)`,
            avgDiscount: drizzleSql<number>`avg(${productSales.discountPercent})`,
          })
          .from(productSales)
          .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
          .where(and(
            ...baseConditions,
            eq(productSources.aspName, aspName)
          ))
          .groupBy(productSources.aspName)
          .orderBy(desc(drizzleSql`count(*)`));

        return {
          totalSales: total,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          byAsp: byAspResult.map((r: any) => ({
            aspName: r.aspName as string,
            count: Number(r.count),
            avgDiscount: Math.round(Number(r.avgDiscount) || 0),
          })),
        };
      }

      // aspNameが指定されていない場合は全ASP対象
      const totalResult = await db
        .select({ count: drizzleSql<number>`count(*)` })
        .from(productSales)
        .where(and(...baseConditions));

      const total = Number(totalResult[0]?.count || 0);

      // ASP別統計
      const byAspResult = await db
        .select({
          aspName: productSources.aspName,
          count: drizzleSql<number>`count(*)`,
          avgDiscount: drizzleSql<number>`avg(${productSales.discountPercent})`,
        })
        .from(productSales)
        .innerJoin(productSources, eq(productSales.productSourceId, productSources.id))
        .where(and(...baseConditions))
        .groupBy(productSources.aspName)
        .orderBy(desc(drizzleSql`count(*)`));

      return {
        totalSales: total,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byAsp: byAspResult.map((r: any) => ({
          aspName: r.aspName as string,
          count: Number(r.count),
          avgDiscount: Math.round(Number(r.avgDiscount) || 0),
        })),
      };
    } catch (error) {
      return logDbErrorAndReturn(error, { totalSales: 0, byAsp: [] }, 'getSaleStats');
    }
  }

  return {
    getSaleProducts,
    getSaleStats,
  };
}
