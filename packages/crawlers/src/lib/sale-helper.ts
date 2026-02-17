/**
 * セール情報保存ヘルパー
 *
 * 各クローラーからセール情報を保存するための共通関数
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

export interface SaleInfo {
  regularPrice: number;
  salePrice: number;
  discountPercent?: number;
  saleName?: string;
  saleType?: string; // 'timesale', 'campaign', 'clearance' など
  endAt?: Date | null;
}

/**
 * セール情報を保存または更新
 * @param aspName ASP名 (MGS, DUGA, DTI, FC2 など)
 * @param originalProductId 元の商品ID
 * @param saleInfo セール情報
 * @returns 保存成功したかどうか
 */
export async function saveSaleInfo(
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
    const discountPercent = saleInfo.discountPercent ||
      Math.round((1 - saleInfo.salePrice / saleInfo.regularPrice) * 100);

    // product_sourceを検索
    const sourceResult = await db.execute(sql`
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
    const existingSale = await db.execute(sql`
      SELECT id, sale_price, discount_percent
      FROM product_sales
      WHERE product_source_id = ${productSourceId}
      AND is_active = TRUE
      LIMIT 1
    `);

    if (existingSale.rows.length > 0) {
      const existing = existingSale.rows[0] as { id: number; sale_price: number; discount_percent: number };
      // 価格が同じなら更新不要
      if (existing.sale_price === saleInfo.salePrice) {
        // fetched_atだけ更新
        await db.execute(sql`
          UPDATE product_sales
          SET fetched_at = NOW()
          WHERE id = ${existing.id}
        `);
        // 同一価格でも日次の価格履歴は記録（価格追跡の継続性のため）
        await recordPriceHistory(productSourceId, saleInfo.regularPrice, saleInfo.salePrice, existing.discount_percent);
        return true;
      }

      // 価格が変わった場合は既存を非アクティブにして新規作成
      await db.execute(sql`
        UPDATE product_sales
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = ${existing.id}
      `);
    }

    // 新しいセール情報を挿入
    await db.execute(sql`
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

    // 価格履歴を記録
    await recordPriceHistory(productSourceId, saleInfo.regularPrice, saleInfo.salePrice, discountPercent);

    return true;
  } catch (error) {
    console.error(`Error saving sale info for ${aspName}/${originalProductId}:`, error);
    return false;
  }
}

/**
 * セールが終了した商品を非アクティブに
 * @param aspName ASP名
 * @param originalProductId 元の商品ID
 */
export async function deactivateSale(
  aspName: string,
  originalProductId: string
): Promise<void> {
  const db = getDb();

  try {
    await db.execute(sql`
      UPDATE product_sales ps
      SET is_active = FALSE, updated_at = NOW()
      FROM product_sources src
      WHERE ps.product_source_id = src.id
      AND src.asp_name = ${aspName}
      AND src.original_product_id = ${originalProductId}
      AND ps.is_active = TRUE
    `);
  } catch (error) {
    console.error(`Error deactivating sale for ${aspName}/${originalProductId}:`, error);
  }
}

/**
 * 期限切れのセールを一括で非アクティブに
 */
export async function deactivateExpiredSales(): Promise<number> {
  const db = getDb();

  const result = await db.execute(sql`
    UPDATE product_sales
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE
    AND end_at IS NOT NULL
    AND end_at < NOW()
    RETURNING id
  `);

  return result.rows.length;
}

/**
 * 価格履歴を記録
 * 1日1回のみ記録（重複防止）
 * @param productSourceId 商品ソースID
 * @param price 通常価格
 * @param salePrice セール価格（nullの場合は通常価格）
 * @param discountPercent 割引率
 */
export async function recordPriceHistory(
  productSourceId: number,
  price: number,
  salePrice?: number | null,
  discountPercent?: number | null
): Promise<boolean> {
  const db = getDb();

  try {
    // ON CONFLICT で同日の重複を防ぐ
    await db.execute(sql`
      INSERT INTO price_history (
        product_source_id,
        price,
        sale_price,
        discount_percent,
        recorded_at
      ) VALUES (
        ${productSourceId},
        ${price},
        ${salePrice || null},
        ${discountPercent || null},
        NOW()
      )
      ON CONFLICT (product_source_id, DATE(recorded_at)) DO UPDATE SET
        price = EXCLUDED.price,
        sale_price = EXCLUDED.sale_price,
        discount_percent = EXCLUDED.discount_percent
    `);
    return true;
  } catch (error) {
    console.error(`Error recording price history for source ${productSourceId}:`, error);
    return false;
  }
}

/**
 * 商品の価格履歴を取得（最新30日分）
 * @param productSourceId 商品ソースID
 * @param limit 取得件数（デフォルト30）
 */
export async function getPriceHistory(
  productSourceId: number,
  limit = 30
): Promise<Array<{
  price: number;
  salePrice: number | null;
  discountPercent: number | null;
  recordedAt: Date;
}>> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT price, sale_price, discount_percent, recorded_at
    FROM price_history
    WHERE product_source_id = ${productSourceId}
    ORDER BY recorded_at DESC
    LIMIT ${limit}
  `);

  interface PriceHistoryRow {
    price: number;
    sale_price: number | null;
    discount_percent: number | null;
    recorded_at: Date;
  }

  return result.rows.map((row) => {
    const r = row as unknown as PriceHistoryRow;
    return {
      price: r.price,
      salePrice: r.sale_price,
      discountPercent: r.discount_percent,
      recordedAt: r.recorded_at,
    };
  });
}
