/**
 * クローラー用バッチ処理ヘルパー
 *
 * N+1クエリ問題を解決するためのバッチ処理関数
 */

import { db } from '../db';
import {
  performers,
  productPerformers,
  tags,
  productTags,
  productImages,
} from '../db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../performer-validation';

// ============================================================
// Performer Batch Operations
// ============================================================

/**
 * 出演者名を正規化・検証してフィルタリング
 */
export function normalizeAndValidatePerformers(
  names: string[],
  productTitle?: string
): string[] {
  return names
    .map((name) => normalizePerformerName(name))
    .filter((name): name is string => name !== null)
    .filter((name) => isValidPerformerName(name))
    .filter((name) => !productTitle || isValidPerformerForProduct(name, productTitle));
}

/**
 * 出演者をバッチで取得または作成
 *
 * N+1問題を解決: 1回のSELECTと1回のINSERTで完了
 *
 * @returns name -> id のマッピング
 */
export async function ensurePerformers(
  names: string[]
): Promise<Map<string, number>> {
  if (names.length === 0) {
    return new Map();
  }

  // 重複を除去
  const uniqueNames = [...new Set(names)];

  // 1. 既存の出演者を一括取得
  const existing = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(inArray(performers.name, uniqueNames));

  const nameToId = new Map<string, number>();
  for (const p of existing) {
    nameToId.set(p.name, p.id);
  }

  // 2. 存在しない出演者を特定
  const toCreate = uniqueNames.filter((name) => !nameToId.has(name));

  // 3. 新規出演者を一括作成
  if (toCreate.length > 0) {
    const created = await db
      .insert(performers)
      .values(toCreate.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: performers.id, name: performers.name });

    for (const p of created) {
      nameToId.set(p.name, p.id);
    }

    // onConflictDoNothingで作成されなかった場合、再取得
    const stillMissing = toCreate.filter((name) => !nameToId.has(name));
    if (stillMissing.length > 0) {
      const refetch = await db
        .select({ id: performers.id, name: performers.name })
        .from(performers)
        .where(inArray(performers.name, stillMissing));

      for (const p of refetch) {
        nameToId.set(p.name, p.id);
      }
    }
  }

  return nameToId;
}

/**
 * 商品と出演者の関連をバッチで作成
 */
export async function linkProductToPerformers(
  productId: number,
  performerIds: number[]
): Promise<void> {
  if (performerIds.length === 0) {
    return;
  }

  // 既存の関連を取得
  const existing = await db
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(eq(productPerformers.productId, productId));

  const existingIds = new Set(existing.map((e) => e.performerId));

  // 新規の関連のみ作成
  const toLink = performerIds.filter((id) => !existingIds.has(id));

  if (toLink.length > 0) {
    await db
      .insert(productPerformers)
      .values(toLink.map((performerId) => ({ productId, performerId })))
      .onConflictDoNothing();
  }
}

/**
 * 出演者の取得/作成と商品への関連付けを一括実行
 */
export async function processProductPerformers(
  productId: number,
  performerNames: string[],
  productTitle?: string
): Promise<{ added: number; total: number }> {
  // 1. 正規化・検証
  const validNames = normalizeAndValidatePerformers(performerNames, productTitle);

  if (validNames.length === 0) {
    return { added: 0, total: 0 };
  }

  // 2. 出演者を取得または作成
  const nameToId = await ensurePerformers(validNames);

  // 3. 商品との関連を作成
  const performerIds = validNames
    .map((name) => nameToId.get(name))
    .filter((id): id is number => id !== undefined);

  // 既存の関連数を取得
  const existingCount = await db
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(eq(productPerformers.productId, productId));

  await linkProductToPerformers(productId, performerIds);

  return {
    added: performerIds.length - existingCount.length,
    total: performerIds.length,
  };
}

// ============================================================
// Tag Batch Operations
// ============================================================

/**
 * タグをバッチで取得または作成
 */
export async function ensureTags(
  tagNames: string[],
  category?: string
): Promise<Map<string, number>> {
  if (tagNames.length === 0) {
    return new Map();
  }

  const uniqueNames = [...new Set(tagNames)];

  // 1. 既存のタグを一括取得
  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.name, uniqueNames));

  const nameToId = new Map<string, number>();
  for (const t of existing) {
    nameToId.set(t.name, t.id);
  }

  // 2. 存在しないタグを作成
  const toCreate = uniqueNames.filter((name) => !nameToId.has(name));

  if (toCreate.length > 0) {
    const created = await db
      .insert(tags)
      .values(toCreate.map((name) => ({ name, category })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name });

    for (const t of created) {
      nameToId.set(t.name, t.id);
    }

    // 再取得が必要な場合
    const stillMissing = toCreate.filter((name) => !nameToId.has(name));
    if (stillMissing.length > 0) {
      const refetch = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, stillMissing));

      for (const t of refetch) {
        nameToId.set(t.name, t.id);
      }
    }
  }

  return nameToId;
}

/**
 * 商品とタグの関連をバッチで作成
 */
export async function linkProductToTags(
  productId: number,
  tagIds: number[]
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }

  const existing = await db
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(eq(productTags.productId, productId));

  const existingIds = new Set(existing.map((e) => e.tagId));
  const toLink = tagIds.filter((id) => !existingIds.has(id));

  if (toLink.length > 0) {
    await db
      .insert(productTags)
      .values(toLink.map((tagId) => ({ productId, tagId })))
      .onConflictDoNothing();
  }
}

// ============================================================
// Image Batch Operations
// ============================================================

/**
 * 商品画像をバッチで保存（既存は上書きしない）
 */
export async function saveProductImages(
  productId: number,
  imageUrls: string[],
  aspName: string,
  imageType: string = 'sample'
): Promise<{ added: number; skipped: number }> {
  if (imageUrls.length === 0) {
    return { added: 0, skipped: 0 };
  }

  // 既存の画像URLを取得
  const existing = await db
    .select({ imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.aspName, aspName),
        eq(productImages.imageType, imageType)
      )
    );

  const existingUrls = new Set(existing.map((e) => e.imageUrl));

  // 重複を除去し、新規のみ抽出
  const uniqueUrls = [...new Set(imageUrls)];
  const toAdd = uniqueUrls.filter((url) => !existingUrls.has(url));

  if (toAdd.length > 0) {
    // 最大のdisplayOrderを取得
    const maxOrder = existing.length;

    await db.insert(productImages).values(
      toAdd.map((imageUrl, index) => ({
        productId,
        imageUrl,
        imageType,
        aspName,
        displayOrder: maxOrder + index + 1,
      }))
    );
  }

  return {
    added: toAdd.length,
    skipped: uniqueUrls.length - toAdd.length,
  };
}

/**
 * 商品画像を置き換え（既存削除→新規追加）
 */
export async function replaceProductImages(
  productId: number,
  imageUrls: string[],
  aspName: string,
  imageType: string = 'sample'
): Promise<number> {
  // 既存の画像を削除
  await db
    .delete(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.aspName, aspName),
        eq(productImages.imageType, imageType)
      )
    );

  if (imageUrls.length === 0) {
    return 0;
  }

  // 重複を除去
  const uniqueUrls = [...new Set(imageUrls)];

  // 新規追加
  await db.insert(productImages).values(
    uniqueUrls.map((imageUrl, index) => ({
      productId,
      imageUrl,
      imageType,
      aspName,
      displayOrder: index + 1,
    }))
  );

  return uniqueUrls.length;
}
