/**
 * クローラー重複防止ヘルパー
 *
 * rawデータと分析データの紐付けを管理し、重複処理を防止
 * GCS保存を優先し、DBにはメタデータのみ保存
 */

import { createHash } from 'crypto';
import { db } from '../db';
import {
  dugaRawResponses,
  sokmilRawResponses,
  mgsRawPages,
  productRawDataLinks,
  rawHtmlData,
} from '../db/schema';
import { eq, and, count, isNull } from 'drizzle-orm';
import { saveRawHtml, saveRawJson } from '../gcs-crawler-helper';

// ============================================================
// Types
// ============================================================

export type SourceType = 'duga' | 'sokmil' | 'mgs' | 'fc2' | 'dti' | 'b10f' | 'japanska' | 'wiki-av-wiki' | 'wiki-seesaawiki' | 'wiki-shiroutoname' | 'wiki-fc2-blog';

export type RawDataTable =
  | 'duga_raw_responses'
  | 'sokmil_raw_responses'
  | 'mgs_raw_pages'
  | 'raw_html_data'
  | 'raw_csv_data';

export interface RawDataCheckResult {
  /** 既存データが存在するか */
  exists: boolean;
  /** 既存データのID */
  existingId?: number;
  /** コンテンツが変更されたか */
  hasChanged: boolean;
  /** 既存のハッシュ */
  existingHash?: string;
  /** 新しいハッシュ */
  newHash: string;
  /** 処理済みか */
  isProcessed: boolean;
  /** GCS URL（存在する場合） */
  gcsUrl?: string;
}

export interface UpsertRawDataResult {
  /** データID */
  id: number;
  /** 新規作成か */
  isNew: boolean;
  /** GCS URL */
  gcsUrl: string | null;
  /** 処理をスキップすべきか（変更なし＆処理済み） */
  shouldSkip: boolean;
}

export interface LinkProductResult {
  /** リンクが作成されたか（既存の場合false） */
  created: boolean;
  /** リンクID */
  linkId: number;
  /** 再処理が必要か（ハッシュが変わった場合） */
  needsReprocessing: boolean;
}

// ============================================================
// Hash Calculation
// ============================================================

/**
 * オブジェクトからSHA256ハッシュを計算
 */
export function calculateHash(data: unknown): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * JSONBデータのハッシュを計算（キーをソートして一貫性を確保）
 */
export function calculateJsonHash(data: Record<string, unknown>): string {
  const sortedKeys = Object.keys(data).sort();
  const sortedData: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedData[key] = data[key];
  }
  return calculateHash(JSON.stringify(sortedData));
}

// ============================================================
// Raw Data Check Functions
// ============================================================

/**
 * DUGA生データの重複チェック
 */
export async function checkDugaRawData(
  productId: string,
  newData: Record<string, unknown>
): Promise<RawDataCheckResult> {
  const newHash = calculateJsonHash(newData);

  const [existing] = await db
    .select()
    .from(dugaRawResponses)
    .where(eq(dugaRawResponses.productId, productId))
    .limit(1);

  if (!existing) {
    return {
      exists: false,
      hasChanged: true,
      newHash,
      isProcessed: false,
    };
  }

  return {
    exists: true,
    existingId: existing.id,
    hasChanged: existing.hash !== newHash,
    existingHash: existing.hash ?? undefined,
    newHash,
    isProcessed: existing.processedAt !== null,
  };
}

/**
 * ソクミル生データの重複チェック
 */
export async function checkSokmilRawData(
  itemId: string,
  apiType: string,
  newData: Record<string, unknown>
): Promise<RawDataCheckResult> {
  const newHash = calculateJsonHash(newData);

  const [existing] = await db
    .select()
    .from(sokmilRawResponses)
    .where(
      and(
        eq(sokmilRawResponses.itemId, itemId),
        eq(sokmilRawResponses.apiType, apiType)
      )
    )
    .limit(1);

  if (!existing) {
    return {
      exists: false,
      hasChanged: true,
      newHash,
      isProcessed: false,
    };
  }

  return {
    exists: true,
    existingId: existing.id,
    hasChanged: existing.hash !== newHash,
    existingHash: existing.hash ?? undefined,
    newHash,
    isProcessed: existing.processedAt !== null,
  };
}

/**
 * MGS生データの重複チェック
 */
export async function checkMgsRawData(
  productUrl: string,
  newHtml: string
): Promise<RawDataCheckResult> {
  const newHash = calculateHash(newHtml);

  const [existing] = await db
    .select()
    .from(mgsRawPages)
    .where(eq(mgsRawPages.productUrl, productUrl))
    .limit(1);

  if (!existing) {
    return {
      exists: false,
      hasChanged: true,
      newHash,
      isProcessed: false,
    };
  }

  return {
    exists: true,
    existingId: existing.id,
    hasChanged: existing.hash !== newHash,
    existingHash: existing.hash ?? undefined,
    newHash,
    isProcessed: existing.processedAt !== null,
  };
}

/**
 * 汎用HTML生データの重複チェック
 */
export async function checkRawHtmlData(
  url: string,
  newHtml: string
): Promise<RawDataCheckResult> {
  const newHash = calculateHash(newHtml);

  const [existing] = await db
    .select()
    .from(rawHtmlData)
    .where(eq(rawHtmlData.url, url))
    .limit(1);

  if (!existing) {
    return {
      exists: false,
      hasChanged: true,
      newHash,
      isProcessed: false,
    };
  }

  return {
    exists: true,
    existingId: existing.id,
    hasChanged: existing.hash !== newHash,
    existingHash: existing.hash ?? undefined,
    newHash,
    isProcessed: existing.processedAt !== null,
  };
}

// ============================================================
// Raw Data Upsert Functions (Legacy - DB only)
// ============================================================

/**
 * DUGA生データの保存/更新 (Legacy)
 * @deprecated Use upsertDugaRawDataWithGcs instead
 */
export async function upsertDugaRawData(
  productId: string,
  rawJson: Record<string, unknown>,
  hash: string
): Promise<{ id: number; isNew: boolean }> {
  const [existing] = await db
    .select({ id: dugaRawResponses.id })
    .from(dugaRawResponses)
    .where(eq(dugaRawResponses.productId, productId))
    .limit(1);

  if (existing) {
    await db
      .update(dugaRawResponses)
      .set({
        rawJson,
        hash,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dugaRawResponses.id, existing.id));
    return { id: existing.id, isNew: false };
  }

  const [inserted] = await db
    .insert(dugaRawResponses)
    .values({
      productId,
      rawJson,
      hash,
    })
    .returning({ id: dugaRawResponses.id });

  return { id: inserted.id, isNew: true };
}

/**
 * ソクミル生データの保存/更新 (Legacy)
 * @deprecated Use upsertSokmilRawDataWithGcs instead
 */
export async function upsertSokmilRawData(
  itemId: string,
  apiType: string,
  rawJson: Record<string, unknown>,
  hash: string
): Promise<{ id: number; isNew: boolean }> {
  const [existing] = await db
    .select({ id: sokmilRawResponses.id })
    .from(sokmilRawResponses)
    .where(
      and(
        eq(sokmilRawResponses.itemId, itemId),
        eq(sokmilRawResponses.apiType, apiType)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(sokmilRawResponses)
      .set({
        rawJson,
        hash,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sokmilRawResponses.id, existing.id));
    return { id: existing.id, isNew: false };
  }

  const [inserted] = await db
    .insert(sokmilRawResponses)
    .values({
      itemId,
      apiType,
      rawJson,
      hash,
    })
    .returning({ id: sokmilRawResponses.id });

  return { id: inserted.id, isNew: true };
}

/**
 * MGS生データの保存/更新 (Legacy)
 * @deprecated Use upsertMgsRawDataWithGcs instead
 */
export async function upsertMgsRawData(
  productUrl: string,
  productId: string | null,
  rawHtmlContent: string,
  rawJson: Record<string, unknown> | null,
  hash: string,
  statusCode = 200
): Promise<{ id: number; isNew: boolean }> {
  const [existing] = await db
    .select({ id: mgsRawPages.id })
    .from(mgsRawPages)
    .where(eq(mgsRawPages.productUrl, productUrl))
    .limit(1);

  if (existing) {
    await db
      .update(mgsRawPages)
      .set({
        productId,
        rawHtml: rawHtmlContent,
        rawJson,
        hash,
        statusCode,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mgsRawPages.id, existing.id));
    return { id: existing.id, isNew: false };
  }

  const [inserted] = await db
    .insert(mgsRawPages)
    .values({
      productUrl,
      productId,
      rawHtml: rawHtmlContent,
      rawJson,
      hash,
      statusCode,
    })
    .returning({ id: mgsRawPages.id });

  return { id: inserted.id, isNew: true };
}

// ============================================================
// Raw Data Upsert Functions with GCS (Recommended)
// ============================================================

/**
 * DUGA生データの保存/更新（GCS優先）
 * - 重複クロール防止: hash比較で変更なしならスキップ
 * - 重複分析防止: processedAtチェック
 * - GCS優先: GCSに保存成功時はDBにはnullを保存
 * 注意: duga_raw_responsesテーブルにはgcsUrlカラムがないため、
 *       GCS保存情報はproduct_raw_data_linksテーブルで管理
 */
export async function upsertDugaRawDataWithGcs(
  productId: string,
  rawJson: Record<string, unknown>
): Promise<UpsertRawDataResult> {
  const hash = calculateJsonHash(rawJson);

  // 既存データをチェック
  const [existing] = await db
    .select()
    .from(dugaRawResponses)
    .where(eq(dugaRawResponses.productId, productId))
    .limit(1);

  // 重複チェック: hashが同じで処理済みならスキップ
  if (existing && existing.hash === hash && existing.processedAt !== null) {
    return {
      id: existing.id,
      isNew: false,
      gcsUrl: null, // duga_raw_responsesにはgcsUrlカラムがない
      shouldSkip: true,
    };
  }

  // GCSに保存（優先）
  const { gcsUrl, rawData: storedRawData } = await saveRawJson('duga', productId, rawJson);

  if (existing) {
    // 更新
    await db
      .update(dugaRawResponses)
      .set({
        rawJson: storedRawData || rawJson, // GCS保存失敗時はDBに保存
        hash,
        fetchedAt: new Date(),
        updatedAt: new Date(),
        processedAt: null, // 再処理のためリセット
      })
      .where(eq(dugaRawResponses.id, existing.id));
    return { id: existing.id, isNew: false, gcsUrl, shouldSkip: false };
  }

  // 新規作成
  const [inserted] = await db
    .insert(dugaRawResponses)
    .values({
      productId,
      rawJson: storedRawData || rawJson, // GCS保存失敗時はDBに保存
      hash,
    })
    .returning({ id: dugaRawResponses.id });

  return { id: inserted.id, isNew: true, gcsUrl, shouldSkip: false };
}

/**
 * ソクミル生データの保存/更新（GCS優先）
 */
export async function upsertSokmilRawDataWithGcs(
  itemId: string,
  apiType: string,
  rawJson: Record<string, unknown>
): Promise<UpsertRawDataResult> {
  const hash = calculateJsonHash(rawJson);

  // 既存データをチェック
  const [existing] = await db
    .select()
    .from(sokmilRawResponses)
    .where(
      and(
        eq(sokmilRawResponses.itemId, itemId),
        eq(sokmilRawResponses.apiType, apiType)
      )
    )
    .limit(1);

  // 重複チェック: hashが同じで処理済みならスキップ
  if (existing && existing.hash === hash && existing.processedAt !== null) {
    return {
      id: existing.id,
      isNew: false,
      gcsUrl: null, // sokmilRawResponsesにはgcsUrlカラムがないため
      shouldSkip: true,
    };
  }

  // GCSに保存（優先）
  const { gcsUrl, rawData: storedRawData } = await saveRawJson('sokmil', `${itemId}-${apiType}`, rawJson);

  if (existing) {
    // 更新
    await db
      .update(sokmilRawResponses)
      .set({
        rawJson: storedRawData || rawJson, // GCS保存失敗時はDBに保存
        hash,
        fetchedAt: new Date(),
        updatedAt: new Date(),
        processedAt: null, // 再処理のためリセット
      })
      .where(eq(sokmilRawResponses.id, existing.id));
    return { id: existing.id, isNew: false, gcsUrl, shouldSkip: false };
  }

  // 新規作成
  const [inserted] = await db
    .insert(sokmilRawResponses)
    .values({
      itemId,
      apiType,
      rawJson: storedRawData || rawJson,
      hash,
    })
    .returning({ id: sokmilRawResponses.id });

  return { id: inserted.id, isNew: true, gcsUrl, shouldSkip: false };
}

/**
 * MGS生データの保存/更新（GCS優先）
 */
export async function upsertMgsRawDataWithGcs(
  productUrl: string,
  productId: string | null,
  rawHtmlContent: string,
  rawJson: Record<string, unknown> | null,
  statusCode = 200
): Promise<UpsertRawDataResult> {
  const hash = calculateHash(rawHtmlContent);

  // 既存データをチェック
  const [existing] = await db
    .select()
    .from(mgsRawPages)
    .where(eq(mgsRawPages.productUrl, productUrl))
    .limit(1);

  // 重複チェック: hashが同じで処理済みならスキップ
  if (existing && existing.hash === hash && existing.processedAt !== null) {
    return {
      id: existing.id,
      isNew: false,
      gcsUrl: null, // mgsRawPagesにはgcsUrlカラムがないため
      shouldSkip: true,
    };
  }

  // GCSに保存（HTML）
  const { gcsUrl, htmlContent: storedHtml } = await saveRawHtml('mgs', productId || productUrl, rawHtmlContent);

  if (existing) {
    // 更新
    await db
      .update(mgsRawPages)
      .set({
        productId,
        rawHtml: storedHtml || rawHtmlContent, // GCS保存失敗時はDBに保存
        rawJson,
        hash,
        statusCode,
        fetchedAt: new Date(),
        updatedAt: new Date(),
        processedAt: null, // 再処理のためリセット
      })
      .where(eq(mgsRawPages.id, existing.id));
    return { id: existing.id, isNew: false, gcsUrl, shouldSkip: false };
  }

  // 新規作成
  const [inserted] = await db
    .insert(mgsRawPages)
    .values({
      productUrl,
      productId,
      rawHtml: storedHtml || rawHtmlContent,
      rawJson,
      hash,
      statusCode,
    })
    .returning({ id: mgsRawPages.id });

  return { id: inserted.id, isNew: true, gcsUrl, shouldSkip: false };
}

/**
 * 汎用HTML生データの保存/更新（GCS優先）
 * FC2, DTI, Japanska等で使用
 */
export async function upsertRawHtmlDataWithGcs(
  source: string,
  productId: string,
  url: string,
  htmlContent: string
): Promise<UpsertRawDataResult> {
  const hash = calculateHash(htmlContent);

  // 既存データをチェック
  const [existing] = await db
    .select()
    .from(rawHtmlData)
    .where(eq(rawHtmlData.url, url))
    .limit(1);

  // 重複チェック: hashが同じで処理済みならスキップ
  if (existing && existing.hash === hash && existing.processedAt !== null) {
    return {
      id: existing.id,
      isNew: false,
      gcsUrl: existing.gcsUrl,
      shouldSkip: true,
    };
  }

  // GCSに保存（HTML）
  const { gcsUrl, htmlContent: storedHtml } = await saveRawHtml(source.toLowerCase(), productId, htmlContent);

  if (existing) {
    // 更新
    await db
      .update(rawHtmlData)
      .set({
        htmlContent: storedHtml, // GCS保存時はnull
        gcsUrl,
        hash,
        crawledAt: new Date(),
        processedAt: null, // 再処理のためリセット
      })
      .where(eq(rawHtmlData.id, existing.id));
    return { id: existing.id, isNew: false, gcsUrl, shouldSkip: false };
  }

  // 新規作成
  const [inserted] = await db
    .insert(rawHtmlData)
    .values({
      source: source.toUpperCase(),
      productId,
      url,
      htmlContent: storedHtml,
      gcsUrl,
      hash,
    })
    .returning({ id: rawHtmlData.id });

  return { id: inserted.id, isNew: true, gcsUrl, shouldSkip: false };
}

// ============================================================
// Product Link Functions
// ============================================================

/**
 * 商品と生データをリンク
 */
export async function linkProductToRawData(
  productId: number,
  sourceType: SourceType,
  rawDataId: number,
  rawDataTable: RawDataTable,
  contentHash: string
): Promise<LinkProductResult> {
  const [existing] = await db
    .select()
    .from(productRawDataLinks)
    .where(
      and(
        eq(productRawDataLinks.productId, productId),
        eq(productRawDataLinks.sourceType, sourceType),
        eq(productRawDataLinks.rawDataId, rawDataId)
      )
    )
    .limit(1);

  if (existing) {
    const needsReprocessing = existing.contentHash !== contentHash;

    if (needsReprocessing) {
      // ハッシュが変わった場合は更新
      await db
        .update(productRawDataLinks)
        .set({ contentHash })
        .where(eq(productRawDataLinks.id, existing.id));
    }

    return {
      created: false,
      linkId: existing.id,
      needsReprocessing,
    };
  }

  const [inserted] = await db
    .insert(productRawDataLinks)
    .values({
      productId,
      sourceType,
      rawDataId,
      rawDataTable,
      contentHash,
    })
    .returning({ id: productRawDataLinks.id });

  return {
    created: true,
    linkId: inserted.id,
    needsReprocessing: false,
  };
}

/**
 * 生データを処理済みとしてマーク
 */
export async function markRawDataAsProcessed(
  sourceType: SourceType,
  rawDataId: number
): Promise<void> {
  const now = new Date();

  switch (sourceType) {
    case 'duga':
      await db
        .update(dugaRawResponses)
        .set({ processedAt: now })
        .where(eq(dugaRawResponses.id, rawDataId));
      break;
    case 'sokmil':
      await db
        .update(sokmilRawResponses)
        .set({ processedAt: now })
        .where(eq(sokmilRawResponses.id, rawDataId));
      break;
    case 'mgs':
      await db
        .update(mgsRawPages)
        .set({ processedAt: now })
        .where(eq(mgsRawPages.id, rawDataId));
      break;
    default:
      // raw_html_data, raw_csv_data用
      await db
        .update(rawHtmlData)
        .set({ processedAt: now })
        .where(eq(rawHtmlData.id, rawDataId));
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * ソースタイプから生データテーブル名を取得
 */
export function getTableNameForSource(sourceType: SourceType): RawDataTable {
  switch (sourceType) {
    case 'duga':
      return 'duga_raw_responses';
    case 'sokmil':
      return 'sokmil_raw_responses';
    case 'mgs':
      return 'mgs_raw_pages';
    case 'fc2':
    case 'dti':
    case 'japanska':
    case 'wiki-av-wiki':
    case 'wiki-seesaawiki':
    case 'wiki-shiroutoname':
    case 'wiki-fc2-blog':
      return 'raw_html_data';
    case 'b10f':
      return 'raw_csv_data';
    default:
      return 'raw_html_data';
  }
}

/**
 * 未処理の生データ件数を取得
 */
export async function getUnprocessedCount(sourceType: SourceType): Promise<number> {
  switch (sourceType) {
    case 'duga': {
      const [result] = await db
        .select({ count: count() })
        .from(dugaRawResponses)
        .where(isNull(dugaRawResponses.processedAt));
      return result?.count ?? 0;
    }
    case 'sokmil': {
      const [result] = await db
        .select({ count: count() })
        .from(sokmilRawResponses)
        .where(isNull(sokmilRawResponses.processedAt));
      return result?.count ?? 0;
    }
    case 'mgs': {
      const [result] = await db
        .select({ count: count() })
        .from(mgsRawPages)
        .where(isNull(mgsRawPages.processedAt));
      return result?.count ?? 0;
    }
    default:
      return 0;
  }
}
