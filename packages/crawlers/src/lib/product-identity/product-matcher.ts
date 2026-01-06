/**
 * 商品マッチング統合モジュール
 *
 * 品番マッチングとタイトル・演者マッチングを統合して
 * 同一商品を検出し、グループを管理する
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { findMatchByProductCode } from './code-matcher';
import { findMatchByTitleAndPerformers } from './title-matcher';
import { createGroup, addToGroup, getProductGroup } from './group-manager';
import type {
  MatchResult,
  ProductForMatching,
  MatchingConfig,
} from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';

/**
 * 商品の同一性マッチングを実行
 *
 * @param product - マッチング対象の商品
 * @param config - マッチング設定
 * @returns マッチ結果（見つからない場合はnull）
 */
export async function findMatch(
  product: ProductForMatching,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<MatchResult | null> {
  // 1. 品番マッチング（高優先度）
  const codeMatch = await findMatchByProductCode(product, config);
  if (codeMatch && codeMatch.confidenceScore >= config.autoMergeThreshold) {
    return codeMatch;
  }

  // 2. タイトル・演者マッチング
  const titleMatch = await findMatchByTitleAndPerformers(product, config);
  if (titleMatch && titleMatch.confidenceScore >= config.reviewThreshold) {
    // 品番マッチもあった場合は信頼度の高い方を選択
    if (codeMatch && codeMatch.confidenceScore > titleMatch.confidenceScore) {
      return codeMatch;
    }
    return titleMatch;
  }

  // 品番マッチのみの場合
  if (codeMatch && codeMatch.confidenceScore >= config.reviewThreshold) {
    return codeMatch;
  }

  return null;
}

/**
 * 商品をグループに登録
 *
 * @param product - 登録する商品
 * @param config - マッチング設定
 * @returns 処理結果
 */
export async function processProductIdentity(
  product: ProductForMatching,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<{
  action: 'created' | 'added' | 'skipped';
  groupId?: number;
  matchResult?: MatchResult;
}> {
  // 既にグループに所属しているか確認
  const existingGroup = await getProductGroup(product['id']);
  if (existingGroup) {
    return { action: 'skipped', groupId: existingGroup.id };
  }

  // マッチングを実行
  const matchResult = await findMatch(product, config);

  if (matchResult && matchResult.groupId) {
    // 既存グループに追加
    await addToGroup(matchResult.groupId, product, matchResult);
    return { action: 'added', groupId: matchResult.groupId, matchResult };
  }

  if (matchResult && matchResult.confidenceScore >= config.autoMergeThreshold) {
    // マッチした商品が所属するグループを確認
    const targetGroup = await getProductGroup(matchResult.productId);
    if (targetGroup) {
      // 既存グループに追加
      await addToGroup(targetGroup.id, product, matchResult);
      return { action: 'added', groupId: targetGroup.id, matchResult };
    }
  }

  // 新規グループを作成
  const groupId = await createGroup(product, 'product_code_exact');
  return { action: 'created', groupId };
}

/**
 * DBから商品情報を取得（マッチング用）
 */
export async function fetchProductForMatching(productId: number): Promise<ProductForMatching | null> {
  const db = getDb();

  const result = await db.execute<{
    id: number;
    normalized_product_id: string;
    maker_product_code: string | null;
    title: string;
    normalized_title: string | null;
    release_date: string | null;
    duration: number | null;
    asp_name: string;
    performers: string | null;
  }>(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.maker_product_code,
      p.title,
      p.normalized_title,
      p.release_date,
      p.duration,
      ps.asp_name,
      (
        SELECT string_agg(perf.name, ',')
        FROM product_performers pp
        JOIN performers perf ON perf.id = pp.performer_id
        WHERE pp.product_id = p.id
      ) as performers
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    WHERE p.id = ${productId}
    LIMIT 1
  `);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    normalizedProductId: row.normalized_product_id,
    makerProductCode: row.maker_product_code,
    title: row.title,
    ...(row.normalized_title !== null && { normalizedTitle: row.normalized_title }),
    releaseDate: row.release_date ? new Date(row.release_date) : null,
    duration: row.duration,
    aspName: row.asp_name,
    performers: row.performers ? row.performers.split(',') : [],
  };
}

/**
 * グループ未所属の商品を取得（バッチ処理用）
 */
export async function fetchUngroupedProducts(
  limit: number,
  offset: number = 0,
  targetAsps?: string[]
): Promise<ProductForMatching[]> {
  const db = getDb();

  let query = sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.maker_product_code,
      p.title,
      p.normalized_title,
      p.release_date,
      p.duration,
      ps.asp_name,
      (
        SELECT string_agg(perf.name, ',')
        FROM product_performers pp
        JOIN performers perf ON perf.id = pp.performer_id
        WHERE pp.product_id = p.id
      ) as performers
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_identity_group_members pigm ON pigm.product_id = p.id
    WHERE pigm.id IS NULL
  `;

  if (targetAsps && targetAsps.length > 0) {
    // SQLインジェクション対策: パラメータ化
    const aspList = targetAsps.map(asp => `'${asp.replace(/'/g, "''")}'`).join(',');
    query = sql`${query} AND ps.asp_name IN (${sql.raw(aspList)})`;
  }

  query = sql`${query} ORDER BY p.id LIMIT ${limit} OFFSET ${offset}`;

  const result = await db.execute<{
    id: number;
    normalized_product_id: string;
    maker_product_code: string | null;
    title: string;
    normalized_title: string | null;
    release_date: string | null;
    duration: number | null;
    asp_name: string;
    performers: string | null;
  }>(query);

  return result.rows.map(row => ({
    id: row['id'],
    normalizedProductId: row.normalized_product_id,
    makerProductCode: row.maker_product_code,
    title: row['title'],
    ...(row.normalized_title !== null && { normalizedTitle: row.normalized_title }),
    releaseDate: row.release_date ? new Date(row.release_date) : null,
    duration: row['duration'],
    aspName: row.asp_name,
    performers: row.performers ? row.performers.split(',') : [],
  }));
}

/**
 * 最近追加された商品を取得（増分処理用）
 */
export async function fetchRecentProducts(
  hoursAgo: number = 24,
  limit: number = 1000
): Promise<ProductForMatching[]> {
  const db = getDb();

  const result = await db.execute<{
    id: number;
    normalized_product_id: string;
    maker_product_code: string | null;
    title: string;
    normalized_title: string | null;
    release_date: string | null;
    duration: number | null;
    asp_name: string;
    performers: string | null;
  }>(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.maker_product_code,
      p.title,
      p.normalized_title,
      p.release_date,
      p.duration,
      ps.asp_name,
      (
        SELECT string_agg(perf.name, ',')
        FROM product_performers pp
        JOIN performers perf ON perf.id = pp.performer_id
        WHERE pp.product_id = p.id
      ) as performers
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_identity_group_members pigm ON pigm.product_id = p.id
    WHERE pigm.id IS NULL
      AND p.created_at >= NOW() - INTERVAL '${sql.raw(String(hoursAgo))} hours'
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `);

  return result.rows.map(row => ({
    id: row['id'],
    normalizedProductId: row.normalized_product_id,
    makerProductCode: row.maker_product_code,
    title: row['title'],
    ...(row.normalized_title !== null && { normalizedTitle: row.normalized_title }),
    releaseDate: row.release_date ? new Date(row.release_date) : null,
    duration: row['duration'],
    aspName: row.asp_name,
    performers: row.performers ? row.performers.split(',') : [],
  }));
}

/**
 * グループ未所属の商品数を取得
 */
export async function countUngroupedProducts(targetAsps?: string[]): Promise<number> {
  const db = getDb();

  let query = sql`
    SELECT COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_identity_group_members pigm ON pigm.product_id = p.id
    WHERE pigm.id IS NULL
  `;

  if (targetAsps && targetAsps.length > 0) {
    const aspList = targetAsps.map(asp => `'${asp.replace(/'/g, "''")}'`).join(',');
    query = sql`${query} AND ps.asp_name IN (${sql.raw(aspList)})`;
  }

  const result = await db.execute<{ count: number }>(query);
  return result.rows[0]?.['count'] || 0;
}
