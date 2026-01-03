import { sql } from '@adult-v/database';

/**
 * 価格履歴クエリ（依存性注入パターン）
 * Raw SQLを使用してDrizzle ORMの型の不一致を回避
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPriceHistoryQueries(getDb: () => any) {
  return {
    /**
     * 価格履歴を記録する
     * 同じ日に複数回記録しない（重複時は更新）
     */
    async recordPrice(
      productSourceId: number,
      price: number,
      salePrice?: number,
      discountPercent?: number,
    ): Promise<boolean> {
      const db = getDb();
      try {
        await db.execute(sql`
          INSERT INTO price_history (product_source_id, price, sale_price, discount_percent, recorded_at)
          VALUES (${productSourceId}, ${price}, ${salePrice ?? null}, ${discountPercent ?? null}, NOW())
          ON CONFLICT (product_source_id, DATE(recorded_at))
          DO UPDATE SET
            price = EXCLUDED.price,
            sale_price = EXCLUDED.sale_price,
            discount_percent = EXCLUDED.discount_percent,
            recorded_at = NOW()
        `);
        return true;
      } catch (error) {
        console.error('Failed to record price history:', error);
        return false;
      }
    },

    /**
     * 商品の価格履歴を取得
     */
    async getPriceHistory(
      productSourceId: number,
      options?: { limit?: number; daysBack?: number },
    ): Promise<PriceHistoryEntry[]> {
      const db = getDb();
      const limit = options?.limit ?? 90;
      const daysBack = options?.daysBack ?? 365;

      const result = await db.execute(sql`
        SELECT
          DATE(recorded_at) as date,
          price,
          sale_price,
          discount_percent
        FROM price_history
        WHERE product_source_id = ${productSourceId}
          AND recorded_at >= NOW() - INTERVAL '${sql.raw(String(daysBack))} days'
        ORDER BY recorded_at DESC
        LIMIT ${limit}
      `);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.rows.map((r: any) => ({
        date: String(r.date),
        price: Number(r.price),
        salePrice: r.sale_price ? Number(r.sale_price) : undefined,
        discountPercent: r.discount_percent ? Number(r.discount_percent) : undefined,
      }));
    },

    /**
     * 商品IDから価格履歴を取得（normalizedProductIdで検索）
     */
    async getPriceHistoryByProductId(
      normalizedProductId: string,
      options?: { limit?: number; daysBack?: number; aspName?: string },
    ): Promise<PriceHistoryWithAsp[]> {
      const db = getDb();
      const limit = options?.limit ?? 90;
      const daysBack = options?.daysBack ?? 365;

      const aspFilter = options?.aspName
        ? sql`AND ps.asp_name = ${options.aspName}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          DATE(ph.recorded_at) as date,
          ph.price,
          ph.sale_price,
          ph.discount_percent,
          ps.asp_name
        FROM price_history ph
        INNER JOIN product_sources ps ON ph.product_source_id = ps.id
        INNER JOIN products p ON ps.product_id = p.id
        WHERE p.normalized_product_id = ${normalizedProductId}
          AND ph.recorded_at >= NOW() - INTERVAL '${sql.raw(String(daysBack))} days'
          ${aspFilter}
        ORDER BY ph.recorded_at DESC
        LIMIT ${limit}
      `);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.rows.map((r: any) => ({
        date: String(r.date),
        price: Number(r.price),
        salePrice: r.sale_price ? Number(r.sale_price) : undefined,
        discountPercent: r.discount_percent ? Number(r.discount_percent) : undefined,
        aspName: String(r.asp_name),
      }));
    },

    /**
     * 価格統計を取得
     */
    async getPriceStats(
      normalizedProductId: string,
      aspName?: string,
    ): Promise<PriceStats | null> {
      const db = getDb();

      const aspFilter = aspName
        ? sql`AND ps.asp_name = ${aspName}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          MIN(ph.price) as min_price,
          MAX(ph.price) as max_price,
          AVG(ph.price) as avg_price,
          MIN(ph.sale_price) as min_sale_price,
          MAX(ph.discount_percent) as max_discount,
          COUNT(*) as record_count,
          MIN(DATE(ph.recorded_at)) as first_recorded,
          MAX(DATE(ph.recorded_at)) as last_recorded
        FROM price_history ph
        INNER JOIN product_sources ps ON ph.product_source_id = ps.id
        INNER JOIN products p ON ps.product_id = p.id
        WHERE p.normalized_product_id = ${normalizedProductId}
          ${aspFilter}
      `);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = result.rows[0] as any;
      if (!stats || Number(stats.record_count) === 0) {
        return null;
      }

      return {
        lowestPrice: stats.min_sale_price ? Number(stats.min_sale_price) : Number(stats.min_price),
        highestPrice: Number(stats.max_price),
        averagePrice: Math.round(Number(stats.avg_price)),
        maxDiscountPercent: stats.max_discount ? Number(stats.max_discount) : 0,
        recordCount: Number(stats.record_count),
        firstRecorded: String(stats.first_recorded),
        lastRecorded: String(stats.last_recorded),
      };
    },

    /**
     * バッチで価格履歴を記録（クローラー用）
     */
    async batchRecordPrices(
      records: Array<{
        productSourceId: number;
        price: number;
        salePrice?: number;
        discountPercent?: number;
      }>,
    ): Promise<{ success: number; failed: number }> {
      const db = getDb();
      let success = 0;
      let failed = 0;

      // バッチで挿入（100件ずつ）
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        try {
          for (const r of batch) {
            await db.execute(sql`
              INSERT INTO price_history (product_source_id, price, sale_price, discount_percent, recorded_at)
              VALUES (${r.productSourceId}, ${r.price}, ${r.salePrice ?? null}, ${r.discountPercent ?? null}, NOW())
              ON CONFLICT DO NOTHING
            `);
          }
          success += batch.length;
        } catch (error) {
          console.error('Batch insert failed:', error);
          failed += batch.length;
        }
      }

      return { success, failed };
    },
  };
}

// 型定義
export interface PriceHistoryEntry {
  date: string;
  price: number;
  salePrice?: number;
  discountPercent?: number;
}

export interface PriceHistoryWithAsp extends PriceHistoryEntry {
  aspName: string;
}

export interface PriceStats {
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  maxDiscountPercent: number;
  recordCount: number;
  firstRecorded: string;
  lastRecorded: string;
}
