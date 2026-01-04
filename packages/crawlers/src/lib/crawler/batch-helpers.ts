/**
 * クローラー用バッチ処理ヘルパー
 *
 * N+1クエリ問題を解決するためのバッチ処理関数
 */

import { db, type DbContext } from '../db';
import {
  performers,
  productPerformers,
  performerAliases,
  tags,
  productTags,
  productImages,
  wikiCrawlData,
} from '../db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../performer-validation';
import { extractProductCodes } from '../crawler-utils';

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
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function linkProductToPerformers(
  productId: number,
  performerIds: number[],
  tx?: DbContext
): Promise<void> {
  if (performerIds.length === 0) {
    return;
  }

  const dbCtx = tx || db;

  // 既存の関連を取得
  const existing = await dbCtx
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(eq(productPerformers.productId, productId));

  const existingIds = new Set(existing.map((e) => e.performerId));

  // 新規の関連のみ作成
  const toLink = performerIds.filter((id) => !existingIds.has(id));

  if (toLink.length > 0) {
    await dbCtx
      .insert(productPerformers)
      .values(toLink.map((performerId) => ({ productId, performerId })))
      .onConflictDoNothing();
  }
}

/**
 * wiki_crawl_dataから品番で演者名を検索
 *
 * @param productCode - 商品コード（品番）
 * @param aspPrefix - ASPプレフィックス（省略可能）
 * @returns 見つかった演者名の配列
 */
async function getPerformersFromWikiData(
  productCode: string,
  aspPrefix?: string
): Promise<string[]> {
  // 品番から複数の検索用品番形式を生成
  const normalizedId = aspPrefix ? `${aspPrefix}-${productCode}` : productCode;
  const productCodes = extractProductCodes(normalizedId);

  // 品番そのものも追加（大文字小文字両方）
  productCodes.push(productCode.toUpperCase());
  productCodes.push(productCode);

  // 重複除去
  const uniqueCodes = [...new Set(productCodes)];

  // wiki_crawl_dataで検索
  const result = await db
    .select({ performerName: wikiCrawlData.performerName })
    .from(wikiCrawlData)
    .where(sql`UPPER(${wikiCrawlData.productCode}) = ANY(ARRAY[${sql.join(uniqueCodes.map(c => sql`${c.toUpperCase()}`), sql`, `)}]::text[])`);

  const performers = [...new Set(result.map(r => r.performerName).filter(name => name && name.length > 0))];

  if (performers.length > 0) {
    console.log(`    📚 wiki_crawl_dataから演者取得: ${performers.join(', ')}`);
  }

  return performers;
}

/**
 * 出演者の取得/作成と商品への関連付けを一括実行
 * wiki_crawl_dataから品番で演者名を検索し、見つかった場合はそれを優先使用
 *
 * @param productId - 商品ID
 * @param performerNames - クローラーから取得した演者名（フォールバック用）
 * @param productTitle - 商品タイトル（バリデーション用）
 * @param productCode - 商品コード（品番）- wiki検索用（省略可能）
 * @param aspPrefix - ASPプレフィックス（省略可能）
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function processProductPerformers(
  productId: number,
  performerNames: string[],
  productTitle?: string,
  productCode?: string,
  aspPrefix?: string,
  tx?: DbContext
): Promise<{ added: number; total: number }> {
  const dbCtx = tx || db;
  let namesToProcess: string[];

  // 1. wiki_crawl_dataから演者名を検索（productCodeが指定されている場合）
  if (productCode) {
    const wikiPerformers = await getPerformersFromWikiData(productCode, aspPrefix);
    if (wikiPerformers.length > 0) {
      namesToProcess = wikiPerformers;
      if (performerNames.length > 0) {
        console.log(`    ℹ️ クローラー取得演者をスキップ: ${performerNames.join(', ')}`);
      }
    } else {
      // wiki_crawl_dataで見つからない場合はクローラーから取得した演者名を使用
      namesToProcess = performerNames;
    }
  } else {
    namesToProcess = performerNames;
  }

  // 2. 正規化・検証
  const validNames = normalizeAndValidatePerformers(namesToProcess, productTitle);

  if (validNames.length === 0) {
    return { added: 0, total: 0 };
  }

  // 3. 出演者を取得または作成（別名検索も含む）
  const nameToId = await ensurePerformersWithAliases(validNames, dbCtx);

  // 4. 商品との関連を作成
  const performerIds = validNames
    .map((name) => nameToId.get(name))
    .filter((id): id is number => id !== undefined);

  // 既存の関連数を取得
  const existingCount = await dbCtx
    .select({ performerId: productPerformers.performerId })
    .from(productPerformers)
    .where(eq(productPerformers.productId, productId));

  await linkProductToPerformers(productId, performerIds, dbCtx);

  return {
    added: performerIds.length - existingCount.length,
    total: performerIds.length,
  };
}

/**
 * 出演者をバッチで取得または作成（別名検索も含む）
 *
 * 検索順序:
 * 1. performers.name で完全一致を検索
 * 2. performer_aliases.alias_name で別名を検索
 * 3. 見つからなければ新規作成
 *
 * @param names - 出演者名の配列
 * @param tx - オプションのトランザクションコンテキスト
 * @returns name -> id のマッピング
 */
async function ensurePerformersWithAliases(
  names: string[],
  tx?: DbContext
): Promise<Map<string, number>> {
  if (names.length === 0) {
    return new Map();
  }

  const dbCtx = tx || db;
  const uniqueNames = [...new Set(names)];
  const nameToId = new Map<string, number>();

  // 1. 既存の出演者を一括取得
  const existing = await dbCtx
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(inArray(performers.name, uniqueNames));

  for (const p of existing) {
    nameToId.set(p.name, p.id);
  }

  // 2. 見つからなかった名前について別名テーブルで検索
  const notFoundNames = uniqueNames.filter((name) => !nameToId.has(name));
  if (notFoundNames.length > 0) {
    const aliasResults = await dbCtx
      .select({
        aliasName: performerAliases.aliasName,
        performerId: performerAliases.performerId,
        performerName: performers.name,
      })
      .from(performerAliases)
      .innerJoin(performers, eq(performerAliases.performerId, performers.id))
      .where(inArray(performerAliases.aliasName, notFoundNames));

    for (const row of aliasResults) {
      nameToId.set(row.aliasName, row.performerId);
      console.log(`    📝 別名マッチ: "${row.aliasName}" → "${row.performerName}" (ID: ${row.performerId})`);
    }
  }

  // 3. まだ見つからない名前は新規作成
  const stillNotFound = uniqueNames.filter((name) => !nameToId.has(name));
  if (stillNotFound.length > 0) {
    const created = await dbCtx
      .insert(performers)
      .values(stillNotFound.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: performers.id, name: performers.name });

    for (const p of created) {
      nameToId.set(p.name, p.id);
    }

    // onConflictDoNothingで作成されなかった場合、再取得
    const stillMissing = stillNotFound.filter((name) => !nameToId.has(name));
    if (stillMissing.length > 0) {
      const refetch = await dbCtx
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

// ============================================================
// Tag Batch Operations
// ============================================================

/**
 * タグをバッチで取得または作成
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function ensureTags(
  tagNames: string[],
  category?: string,
  tx?: DbContext
): Promise<Map<string, number>> {
  if (tagNames.length === 0) {
    return new Map();
  }

  const dbCtx = tx || db;
  const uniqueNames = [...new Set(tagNames)];

  // 1. 既存のタグを一括取得
  const existing = await dbCtx
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
    const created = await dbCtx
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
      const refetch = await dbCtx
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
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function linkProductToTags(
  productId: number,
  tagIds: number[],
  tx?: DbContext
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }

  const dbCtx = tx || db;

  const existing = await dbCtx
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(eq(productTags.productId, productId));

  const existingIds = new Set(existing.map((e) => e.tagId));
  const toLink = tagIds.filter((id) => !existingIds.has(id));

  if (toLink.length > 0) {
    await dbCtx
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
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function saveProductImages(
  productId: number,
  imageUrls: string[],
  aspName: string,
  imageType: string = 'sample',
  tx?: DbContext
): Promise<{ added: number; skipped: number }> {
  if (imageUrls.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const dbCtx = tx || db;

  // 既存の画像URLを取得
  const existing = await dbCtx
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

    await dbCtx.insert(productImages).values(
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
 * @param tx - オプションのトランザクションコンテキスト
 */
export async function replaceProductImages(
  productId: number,
  imageUrls: string[],
  aspName: string,
  imageType: string = 'sample',
  tx?: DbContext
): Promise<number> {
  const dbCtx = tx || db;

  // 既存の画像を削除
  await dbCtx
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
  await dbCtx.insert(productImages).values(
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
