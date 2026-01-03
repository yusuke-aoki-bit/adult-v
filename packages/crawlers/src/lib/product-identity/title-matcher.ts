/**
 * タイトル・演者マッチング
 *
 * タイトルの類似度と演者情報を使用して同一商品を検出
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import type {
  MatchResult,
  ProductForMatching,
  MatchingConfig,
} from './types';
import { DEFAULT_MATCHING_CONFIG, TITLE_MATCH_EXCLUDED_ASPS } from './types';

/**
 * タイトルの正規化
 * 空白・句読点を除去して小文字化
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[\s　]+/g, '')        // 全角・半角スペース除去
    .replace(/[！!？?「」『』【】（）()＆&～~・:：,，。.、\[\]]/g, '') // 記号除去
    .toLowerCase();
}

/**
 * タイトル・演者による同一商品検索
 *
 * @param product - 検索対象の商品
 * @param config - マッチング設定
 * @returns マッチ結果（見つからない場合はnull）
 */
export async function findMatchByTitleAndPerformers(
  product: ProductForMatching,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<MatchResult | null> {
  const db = getDb();

  // タイトルマッチング除外ASPのチェック
  if (TITLE_MATCH_EXCLUDED_ASPS.has(product.aspName)) {
    return null;
  }

  const normalizedTitle = product.normalizedTitle || normalizeTitle(product.title);

  // 類似タイトルの商品を検索（pg_trgm使用）
  const similarProducts = await findSimilarTitleProducts(
    normalizedTitle,
    product.id,
    product.aspName,
    0.6 // 最低類似度閾値
  );

  if (similarProducts.length === 0) {
    return null;
  }

  // 各候補について演者マッチングを評価
  for (const candidate of similarProducts) {
    const result = await evaluateMatch(product, candidate, config);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * 類似タイトルの商品を検索
 */
async function findSimilarTitleProducts(
  normalizedTitle: string,
  excludeProductId: number,
  excludeAspName: string,
  minSimilarity: number
): Promise<Array<{
  productId: number;
  groupId?: number;
  aspName: string;
  similarity: number;
  releaseDate: Date | null;
  duration: number | null;
  performers: string[];
}>> {
  const db = getDb();

  // pg_trgm の similarity() を使用して類似タイトルを検索
  const result = await db.execute<{
    product_id: number;
    group_id: number | null;
    asp_name: string;
    similarity: number;
    release_date: string | null;
    duration: number | null;
    performers: string | null;
  }>(sql`
    SELECT
      p.id as product_id,
      pigm.group_id,
      ps.asp_name,
      similarity(p.normalized_title, ${normalizedTitle}) as similarity,
      p.release_date,
      p.duration,
      (
        SELECT string_agg(perf.name, ',')
        FROM product_performers pp
        JOIN performers perf ON perf.id = pp.performer_id
        WHERE pp.product_id = p.id
      ) as performers
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_identity_group_members pigm ON pigm.product_id = p.id
    WHERE p.id != ${excludeProductId}
      AND p.normalized_title IS NOT NULL
      AND ps.asp_name NOT IN ('FC2', 'fc2', 'DUGA', 'duga')
      AND ps.asp_name != ${excludeAspName}
      AND similarity(p.normalized_title, ${normalizedTitle}) >= ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT 20
  `);

  return result.rows.map(row => ({
    productId: row.product_id,
    groupId: row.group_id ?? undefined,
    aspName: row.asp_name,
    similarity: row.similarity,
    releaseDate: row.release_date ? new Date(row.release_date) : null,
    duration: row.duration,
    performers: row.performers ? row.performers.split(',') : [],
  }));
}

/**
 * マッチングを評価
 */
async function evaluateMatch(
  source: ProductForMatching,
  candidate: {
    productId: number;
    groupId?: number;
    aspName: string;
    similarity: number;
    releaseDate: Date | null;
    duration: number | null;
    performers: string[];
  },
  config: MatchingConfig
): Promise<MatchResult | null> {
  // 演者の一致数を計算
  const matchedPerformers = calculateMatchedPerformers(source.performers, candidate.performers);
  const totalPerformers = Math.max(source.performers.length, candidate.performers.length);

  // 1. タイトル類似度 >= 0.8 + 全演者一致
  if (
    candidate.similarity >= 0.8 &&
    totalPerformers > 0 &&
    matchedPerformers === totalPerformers
  ) {
    return {
      productId: candidate.productId,
      groupId: candidate.groupId,
      confidenceScore: config.titlePerformerHigh,
      matchingMethod: 'title_performer_high',
      aspName: candidate.aspName,
      titleSimilarity: candidate.similarity,
      matchedPerformerCount: matchedPerformers,
    };
  }

  // 2. タイトル類似度 >= 0.7 + 2名以上一致
  if (candidate.similarity >= 0.7 && matchedPerformers >= 2) {
    return {
      productId: candidate.productId,
      groupId: candidate.groupId,
      confidenceScore: config.titlePerformerMedium,
      matchingMethod: 'title_performer_medium',
      aspName: candidate.aspName,
      titleSimilarity: candidate.similarity,
      matchedPerformerCount: matchedPerformers,
    };
  }

  // 3. タイトル類似度 >= 0.6 + 1名一致
  if (candidate.similarity >= 0.6 && matchedPerformers >= 1) {
    return {
      productId: candidate.productId,
      groupId: candidate.groupId,
      confidenceScore: config.titlePerformerLow,
      matchingMethod: 'title_performer_low',
      aspName: candidate.aspName,
      titleSimilarity: candidate.similarity,
      matchedPerformerCount: matchedPerformers,
    };
  }

  // 4. タイトル類似度 >= 0.9 + 同一再生時間（±5分）
  if (
    candidate.similarity >= 0.9 &&
    source.duration &&
    candidate.duration &&
    Math.abs(source.duration - candidate.duration) <= 5
  ) {
    return {
      productId: candidate.productId,
      groupId: candidate.groupId,
      confidenceScore: config.titleOnlyStrict,
      matchingMethod: 'title_only_strict',
      aspName: candidate.aspName,
      titleSimilarity: candidate.similarity,
    };
  }

  // 5. タイトル類似度 >= 0.85 + 同一発売日
  if (
    candidate.similarity >= 0.85 &&
    source.releaseDate &&
    candidate.releaseDate &&
    isSameDate(source.releaseDate, candidate.releaseDate)
  ) {
    return {
      productId: candidate.productId,
      groupId: candidate.groupId,
      confidenceScore: config.titleOnlyRelaxed,
      matchingMethod: 'title_only_relaxed',
      aspName: candidate.aspName,
      titleSimilarity: candidate.similarity,
    };
  }

  return null;
}

/**
 * 演者の一致数を計算
 */
function calculateMatchedPerformers(performers1: string[], performers2: string[]): number {
  if (performers1.length === 0 || performers2.length === 0) {
    return 0;
  }

  // 演者名を正規化して比較
  const normalized1 = new Set(performers1.map(normalizePerformerName));
  const normalized2 = new Set(performers2.map(normalizePerformerName));

  let matchCount = 0;
  for (const name of normalized1) {
    if (normalized2.has(name)) {
      matchCount++;
    }
  }

  return matchCount;
}

/**
 * 演者名の正規化
 */
function normalizePerformerName(name: string): string {
  return name
    .replace(/[\s　]+/g, '')   // スペース除去
    .replace(/[・]/g, '')       // 中点除去
    .toLowerCase();
}

/**
 * 日付が同一かどうかを判定
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 2つのタイトル間の類似度を計算（ローカル計算用）
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (norm1 === norm2) return 1.0;

  // Jaccard類似度を使用
  const set1 = new Set(norm1);
  const set2 = new Set(norm2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}
