/**
 * 商品品番マッチング
 *
 * 品番（maker_product_code）を使用して同一商品を検出
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { normalizeProductCode, parseProductCode } from '../product-code-utils';
import type { MatchResult, ProductForMatching, MatchingConfig } from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';

/**
 * 品番による同一商品検索
 *
 * @param product - 検索対象の商品
 * @param config - マッチング設定
 * @returns マッチ結果（見つからない場合はnull）
 */
export async function findMatchByProductCode(
  product: ProductForMatching,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG,
): Promise<MatchResult | null> {
  const db = getDb();

  // 1. maker_product_code が設定されている場合、完全一致を検索
  if (product.makerProductCode) {
    const exactMatch = await findByExactCode(product.makerProductCode, product['id']);
    if (exactMatch) {
      return {
        productId: exactMatch.productId,
        ...(exactMatch.groupId !== undefined && { groupId: exactMatch.groupId }),
        confidenceScore: config.codeExactMatch,
        matchingMethod: 'product_code_exact',
        aspName: exactMatch.aspName,
      };
    }
  }

  // 2. 正規化品番による検索
  // normalizedProductId や makerProductCode から品番を抽出して正規化
  const normalizedCode = extractAndNormalizeCode(product);
  if (normalizedCode) {
    const normalizedMatch = await findByNormalizedCode(normalizedCode, product['id']);
    if (normalizedMatch) {
      return {
        productId: normalizedMatch.productId,
        ...(normalizedMatch.groupId !== undefined && { groupId: normalizedMatch.groupId }),
        confidenceScore: config.codeNormalizedMatch,
        matchingMethod: 'product_code_normalized',
        aspName: normalizedMatch.aspName,
      };
    }
  }

  return null;
}

/**
 * maker_product_code の完全一致検索
 */
async function findByExactCode(
  code: string,
  excludeProductId: number,
): Promise<{ productId: number; groupId?: number; aspName: string } | null> {
  const db = getDb();

  // 既存グループから検索
  const groupResult = await db.execute<{
    product_id: number;
    group_id: number;
    asp_name: string;
  }>(sql`
    SELECT
      p.id as product_id,
      pigm.group_id,
      ps.asp_name
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_identity_group_members pigm ON pigm.product_id = p.id
    WHERE p.maker_product_code = ${code}
      AND p.id != ${excludeProductId}
    ORDER BY pigm.group_id IS NOT NULL DESC, p.created_at ASC
    LIMIT 1
  `);

  if (groupResult.rows.length > 0) {
    const row = groupResult.rows[0];
    if (row) {
      return {
        productId: row.product_id,
        ...(row.group_id && { groupId: row.group_id }),
        aspName: row.asp_name,
      };
    }
  }

  return null;
}

/**
 * 正規化品番による検索
 *
 * maker_product_code を正規化して比較
 */
async function findByNormalizedCode(
  normalizedCode: string,
  excludeProductId: number,
): Promise<{ productId: number; groupId?: number; aspName: string } | null> {
  const db = getDb();

  // 既存の product_identity_groups から canonical_product_code で検索
  const groupResult = await db.execute<{
    product_id: number;
    group_id: number;
    asp_name: string;
  }>(sql`
    SELECT
      pig.master_product_id as product_id,
      pig.id as group_id,
      COALESCE(pigm.asp_name, 'unknown') as asp_name
    FROM product_identity_groups pig
    LEFT JOIN product_identity_group_members pigm ON pigm.group_id = pig.id AND pigm.product_id = pig.master_product_id
    WHERE pig.canonical_product_code = ${normalizedCode}
    LIMIT 1
  `);

  if (groupResult.rows.length > 0) {
    const row = groupResult.rows[0];
    if (row) {
      return {
        productId: row.product_id,
        groupId: row.group_id,
        aspName: row.asp_name,
      };
    }
  }

  // グループがない場合、products テーブルから直接検索
  // 正規化した品番がマッチする他の商品を探す
  const productResult = await db.execute<{
    product_id: number;
    asp_name: string;
    maker_product_code: string;
  }>(sql`
    SELECT
      p.id as product_id,
      ps.asp_name,
      p.maker_product_code
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    WHERE p.maker_product_code IS NOT NULL
      AND p.id != ${excludeProductId}
    ORDER BY p.created_at ASC
    LIMIT 500
  `);

  // 各商品の品番を正規化して比較
  for (const row of productResult.rows) {
    const otherNormalized = normalizeProductCode(row.maker_product_code);
    if (otherNormalized === normalizedCode) {
      return {
        productId: row.product_id,
        aspName: row.asp_name,
      };
    }
  }

  return null;
}

/**
 * 商品情報から品番を抽出して正規化
 */
export function extractAndNormalizeCode(product: ProductForMatching): string | null {
  // 1. maker_product_code があればそれを正規化
  if (product.makerProductCode) {
    const normalized = normalizeProductCode(product.makerProductCode);
    if (normalized) return normalized;
  }

  // 2. normalizedProductId から品番部分を抽出
  // 形式: "FANZA-ssis00865", "MGS-ssis-865", etc.
  const parts = product.normalizedProductId.split('-');
  if (parts.length >= 2) {
    // ASPプレフィックスを除去して結合
    const codeCandidate = parts.slice(1).join('-');
    const normalized = normalizeProductCode(codeCandidate);
    if (normalized) return normalized;

    // 最後の部分だけで試す
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const normalizedLast = normalizeProductCode(lastPart);
      if (normalizedLast) return normalizedLast;
    }
  }

  // 3. タイトルから品番を抽出（例: "【SSIS-865】タイトル..."）
  const titleMatch = product['title'].match(/[【\[]?\s*([A-Z0-9]+-\d+)\s*[】\]]?/);
  if (titleMatch && titleMatch[1]) {
    const normalized = normalizeProductCode(titleMatch[1]);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * 品番の類似度を計算
 *
 * @param code1 - 品番1
 * @param code2 - 品番2
 * @returns 類似度 (0-1)
 */
export function calculateCodeSimilarity(code1: string, code2: string): number {
  const parsed1 = parseProductCode(code1);
  const parsed2 = parseProductCode(code2);

  if (!parsed1 || !parsed2) return 0;

  // 完全一致
  if (parsed1.normalized === parsed2.normalized) return 1.0;

  // プレフィックスが同じで番号が近い場合
  if (parsed1.prefix === parsed2.prefix) {
    const num1 = parseInt(parsed1.number, 10);
    const num2 = parseInt(parsed2.number, 10);
    const diff = Math.abs(num1 - num2);

    // 番号が1-2しか違わない場合は高い類似度（Vol.1, Vol.2 のような続編の可能性）
    if (diff <= 2) return 0.3; // 続編の可能性が高いので低めのスコア
    if (diff <= 10) return 0.1;
  }

  return 0;
}
