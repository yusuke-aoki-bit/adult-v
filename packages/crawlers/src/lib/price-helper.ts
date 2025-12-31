/**
 * 商品価格保存ヘルパー
 *
 * 各クローラーから価格タイプ別の価格を保存するための共通関数
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

// 価格タイプの定義
export type PriceType = 'download' | 'streaming' | 'hd' | '4k' | 'sd' | 'rental' | 'subscription';

// 価格タイプの表示順（小さいほど優先度が高い）
const PRICE_TYPE_ORDER: Record<PriceType, number> = {
  '4k': 0,
  'hd': 1,
  'download': 2,
  'streaming': 3,
  'sd': 4,
  'rental': 5,
  'subscription': 6,
};

// 価格タイプがデフォルトとして扱われるかどうか
const DEFAULT_PRICE_TYPES: PriceType[] = ['hd', 'download'];

export interface PriceInfo {
  priceType: PriceType;
  price: number;
  currency?: string;
}

/**
 * 商品ソースIDを取得
 */
async function getProductSourceId(aspName: string, originalProductId: string): Promise<number | null> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT id FROM product_sources
    WHERE asp_name = ${aspName}
    AND original_product_id = ${originalProductId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.rows[0] as any).id;
}

/**
 * 単一の価格を保存
 */
export async function saveProductPrice(
  aspName: string,
  originalProductId: string,
  priceInfo: PriceInfo
): Promise<boolean> {
  const db = getDb();

  try {
    const productSourceId = await getProductSourceId(aspName, originalProductId);
    if (!productSourceId) {
      return false;
    }

    const isDefault = DEFAULT_PRICE_TYPES.includes(priceInfo.priceType);
    const displayOrder = PRICE_TYPE_ORDER[priceInfo.priceType] ?? 99;

    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, currency, is_default, display_order)
      VALUES (${productSourceId}, ${priceInfo.priceType}, ${priceInfo.price}, ${priceInfo.currency || 'JPY'}, ${isDefault}, ${displayOrder})
      ON CONFLICT (product_source_id, price_type)
      DO UPDATE SET
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        updated_at = NOW()
    `);

    return true;
  } catch (error) {
    console.error(`Error saving price for ${aspName}/${originalProductId}:`, error);
    return false;
  }
}

/**
 * 複数の価格を一括保存
 */
export async function saveProductPrices(
  aspName: string,
  originalProductId: string,
  prices: PriceInfo[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const priceInfo of prices) {
    const result = await saveProductPrice(aspName, originalProductId, priceInfo);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * 商品ソースIDから価格を保存（productSourceIdを直接使用）
 */
export async function saveProductPriceBySourceId(
  productSourceId: number,
  priceInfo: PriceInfo
): Promise<boolean> {
  const db = getDb();

  try {
    const isDefault = DEFAULT_PRICE_TYPES.includes(priceInfo.priceType);
    const displayOrder = PRICE_TYPE_ORDER[priceInfo.priceType] ?? 99;

    await db.execute(sql`
      INSERT INTO product_prices (product_source_id, price_type, price, currency, is_default, display_order)
      VALUES (${productSourceId}, ${priceInfo.priceType}, ${priceInfo.price}, ${priceInfo.currency || 'JPY'}, ${isDefault}, ${displayOrder})
      ON CONFLICT (product_source_id, price_type)
      DO UPDATE SET
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        updated_at = NOW()
    `);

    return true;
  } catch (error) {
    console.error(`Error saving price for source ${productSourceId}:`, error);
    return false;
  }
}

/**
 * 複数の価格を一括保存（productSourceIdを直接使用）
 */
export async function saveProductPricesBySourceId(
  productSourceId: number,
  prices: PriceInfo[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const priceInfo of prices) {
    const result = await saveProductPriceBySourceId(productSourceId, priceInfo);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * クローラー用: 抽出された価格情報をPriceInfo配列に変換
 */
export function buildPriceInfoList(prices: {
  downloadPrice?: number | null;
  streamingPrice?: number | null;
  hdPrice?: number | null;
  fourKPrice?: number | null;
  sdPrice?: number | null;
}): PriceInfo[] {
  const result: PriceInfo[] = [];

  if (prices.fourKPrice) {
    result.push({ priceType: '4k', price: prices.fourKPrice });
  }
  if (prices.hdPrice) {
    result.push({ priceType: 'hd', price: prices.hdPrice });
  }
  if (prices.downloadPrice) {
    result.push({ priceType: 'download', price: prices.downloadPrice });
  }
  if (prices.streamingPrice) {
    result.push({ priceType: 'streaming', price: prices.streamingPrice });
  }
  if (prices.sdPrice) {
    result.push({ priceType: 'sd', price: prices.sdPrice });
  }

  return result;
}

/**
 * 商品の全価格を取得
 */
export async function getProductPrices(
  aspName: string,
  originalProductId: string
): Promise<PriceInfo[]> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT pp.price_type, pp.price, pp.currency
    FROM product_prices pp
    INNER JOIN product_sources ps ON pp.product_source_id = ps.id
    WHERE ps.asp_name = ${aspName}
    AND ps.original_product_id = ${originalProductId}
    ORDER BY pp.display_order
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    priceType: row.price_type as PriceType,
    price: Number(row.price),
    currency: row.currency || 'JPY',
  }));
}

/**
 * 代表価格（デフォルト価格）を取得
 */
export async function getDefaultPrice(
  aspName: string,
  originalProductId: string
): Promise<number | null> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT pp.price
    FROM product_prices pp
    INNER JOIN product_sources ps ON pp.product_source_id = ps.id
    WHERE ps.asp_name = ${aspName}
    AND ps.original_product_id = ${originalProductId}
    ORDER BY pp.display_order
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Number((result.rows[0] as any).price);
}
