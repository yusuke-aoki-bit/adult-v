/**
 * 同一性グループ管理
 *
 * product_identity_groups と product_identity_group_members の操作
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import type { MatchResult, MatchingMethod, ProductForMatching } from './types';
import { extractAndNormalizeCode } from './code-matcher';

/**
 * グループ情報
 */
interface GroupInfo {
  id: number;
  masterProductId: number | null;
  canonicalProductCode: string | null;
  memberCount: number;
}

/**
 * 新しいグループを作成
 */
export async function createGroup(product: ProductForMatching, matchingMethod: MatchingMethod): Promise<number> {
  const db = getDb();

  const canonicalCode = extractAndNormalizeCode(product);

  // グループを作成
  const groupResult = await db.execute<{ id: number }>(sql`
    INSERT INTO product_identity_groups (master_product_id, canonical_product_code, created_at, updated_at)
    VALUES (${product['id']}, ${canonicalCode}, NOW(), NOW())
    RETURNING id
  `);

  const groupId = groupResult.rows[0]!.id;

  // メンバーを追加
  await db.execute(sql`
    INSERT INTO product_identity_group_members
      (group_id, product_id, confidence_score, matching_method, asp_name, created_at)
    VALUES
      (${groupId}, ${product['id']}, 100, ${matchingMethod}, ${product['aspName']}, NOW())
  `);

  return groupId;
}

/**
 * 既存グループに商品を追加
 */
export async function addToGroup(
  groupId: number,
  product: ProductForMatching,
  matchResult: MatchResult,
): Promise<void> {
  const db = getDb();

  // 既にグループに所属していないか確認
  const existingMember = await db.execute<{ id: number }>(sql`
    SELECT id FROM product_identity_group_members
    WHERE group_id = ${groupId} AND product_id = ${product['id']}
    LIMIT 1
  `);

  if (existingMember.rows.length > 0) {
    // 既に所属している場合はスキップ
    return;
  }

  // メンバーを追加
  await db.execute(sql`
    INSERT INTO product_identity_group_members
      (group_id, product_id, confidence_score, matching_method, asp_name, created_at)
    VALUES
      (${groupId}, ${product['id']}, ${matchResult.confidenceScore}, ${matchResult.matchingMethod}, ${product['aspName']}, NOW())
  `);

  // マスター商品を再評価
  await updateMasterProduct(groupId);
}

/**
 * 商品のグループ所属を確認
 */
export async function getProductGroup(productId: number): Promise<GroupInfo | null> {
  const db = getDb();

  const result = await db.execute<{
    group_id: number;
    master_product_id: number | null;
    canonical_product_code: string | null;
    member_count: number;
  }>(sql`
    SELECT
      pig.id as group_id,
      pig.master_product_id,
      pig.canonical_product_code,
      (SELECT COUNT(*) FROM product_identity_group_members WHERE group_id = pig.id) as member_count
    FROM product_identity_groups pig
    JOIN product_identity_group_members pigm ON pigm.group_id = pig.id
    WHERE pigm.product_id = ${productId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.group_id,
    masterProductId: row.master_product_id,
    canonicalProductCode: row.canonical_product_code,
    memberCount: row.member_count,
  };
}

/**
 * グループのマスター商品を更新
 * 優先度: FANZA > MGS > その他、メタデータ充実度、作成日の古さ
 */
async function updateMasterProduct(groupId: number): Promise<void> {
  const db = getDb();

  // グループメンバーの情報を取得
  const members = await db.execute<{
    product_id: number;
    asp_name: string;
    image_count: number;
    review_count: number;
    created_at: string;
    price: number | null;
  }>(sql`
    SELECT
      pigm.product_id,
      pigm.asp_name,
      (SELECT COUNT(*) FROM product_images WHERE product_id = pigm.product_id) as image_count,
      (SELECT COUNT(*) FROM product_reviews WHERE product_id = pigm.product_id) as review_count,
      p.created_at,
      (SELECT ps.price FROM product_sources ps WHERE ps.product_id = p.id LIMIT 1) as price
    FROM product_identity_group_members pigm
    JOIN products p ON p.id = pigm.product_id
    WHERE pigm.group_id = ${groupId}
  `);

  if (members.rows.length === 0) {
    return;
  }

  // スコアを計算してソート
  const scored = members.rows.map((row) => ({
    productId: row.product_id,
    score: calculateMasterScore(row.asp_name, row.image_count, row.review_count),
    createdAt: new Date(row.created_at),
    price: row['price'],
  }));

  scored.sort((a, b) => {
    // スコアで降順ソート
    if (b.score !== a.score) return b.score - a.score;
    // 同スコアなら古い方を優先
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const masterId = scored[0]!.productId;

  // マスター商品を更新
  await db.execute(sql`
    UPDATE product_identity_groups
    SET master_product_id = ${masterId}, updated_at = NOW()
    WHERE id = ${groupId}
  `);
}

/**
 * マスター商品スコアを計算
 */
function calculateMasterScore(aspName: string, imageCount: number, reviewCount: number): number {
  // ASP優先度（FANZAが最高）
  const aspPriorities: Record<string, number> = {
    FANZA: 100,
    MGS: 80,
    SOKMIL: 60,
    B10F: 50,
    DUGA: 40,
    FC2: 30,
    Japanska: 20,
    Caribbean: 20,
    TokyoHot: 20,
    '1pondo': 20,
    Heyzo: 20,
  };

  const aspScore = aspPriorities[aspName] || 10;
  const metadataScore = Math.min(imageCount * 2, 20) + Math.min(reviewCount * 5, 30);

  return aspScore + metadataScore;
}

/**
 * グループを統合（2つのグループを1つにマージ）
 */
export async function mergeGroups(targetGroupId: number, sourceGroupId: number): Promise<void> {
  const db = getDb();

  // ソースグループのメンバーをターゲットに移動
  await db.execute(sql`
    UPDATE product_identity_group_members
    SET group_id = ${targetGroupId}
    WHERE group_id = ${sourceGroupId}
  `);

  // ソースグループを削除
  await db.execute(sql`
    DELETE FROM product_identity_groups WHERE id = ${sourceGroupId}
  `);

  // マスター商品を再評価
  await updateMasterProduct(targetGroupId);
}

/**
 * グループから商品を削除
 */
export async function removeFromGroup(productId: number): Promise<boolean> {
  const db = getDb();

  // 所属グループを取得
  const group = await getProductGroup(productId);
  if (!group) {
    return false;
  }

  // メンバーを削除
  await db.execute(sql`
    DELETE FROM product_identity_group_members
    WHERE product_id = ${productId}
  `);

  // グループが空になったら削除、そうでなければマスターを更新
  if (group.memberCount <= 1) {
    await db.execute(sql`
      DELETE FROM product_identity_groups WHERE id = ${group.id}
    `);
  } else {
    await updateMasterProduct(group.id);
  }

  return true;
}

/**
 * グループのメンバー一覧を取得
 */
export async function getGroupMembers(groupId: number): Promise<
  Array<{
    productId: number;
    aspName: string;
    confidenceScore: number;
    matchingMethod: string;
    isMaster: boolean;
  }>
> {
  const db = getDb();

  const result = await db.execute<{
    product_id: number;
    asp_name: string;
    confidence_score: number;
    matching_method: string;
    is_master: boolean;
  }>(sql`
    SELECT
      pigm.product_id,
      pigm.asp_name,
      pigm.confidence_score,
      pigm.matching_method,
      (pigm.product_id = pig.master_product_id) as is_master
    FROM product_identity_group_members pigm
    JOIN product_identity_groups pig ON pig.id = pigm.group_id
    WHERE pigm.group_id = ${groupId}
    ORDER BY is_master DESC, pigm.confidence_score DESC
  `);

  return result.rows.map((row) => ({
    productId: row.product_id,
    aspName: row.asp_name,
    confidenceScore: row.confidence_score,
    matchingMethod: row.matching_method,
    isMaster: row.is_master,
  }));
}

/**
 * 同一性グループの統計を取得
 */
export async function getGroupStats(): Promise<{
  totalGroups: number;
  totalGroupedProducts: number;
  avgMembersPerGroup: number;
  groupsByMethod: Record<string, number>;
}> {
  const db = getDb();

  const statsResult = await db.execute<{
    total_groups: number;
    total_grouped_products: number;
    avg_members: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT pig.id) as total_groups,
      COUNT(pigm.id) as total_grouped_products,
      AVG((SELECT COUNT(*) FROM product_identity_group_members WHERE group_id = pig.id)) as avg_members
    FROM product_identity_groups pig
    LEFT JOIN product_identity_group_members pigm ON pigm.group_id = pig.id
  `);

  const methodResult = await db.execute<{
    matching_method: string;
    count: number;
  }>(sql`
    SELECT matching_method, COUNT(*) as count
    FROM product_identity_group_members
    GROUP BY matching_method
  `);

  const groupsByMethod: Record<string, number> = {};
  for (const row of methodResult.rows) {
    groupsByMethod[row.matching_method] = row['count'];
  }

  const stats = statsResult.rows[0];
  if (!stats) {
    return {
      totalGroups: 0,
      totalGroupedProducts: 0,
      avgMembersPerGroup: 0,
      groupsByMethod,
    };
  }
  return {
    totalGroups: stats.total_groups || 0,
    totalGroupedProducts: stats.total_grouped_products || 0,
    avgMembersPerGroup: stats.avg_members || 0,
    groupsByMethod,
  };
}
