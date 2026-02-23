/**
 * クローラー用GCSヘルパー関数
 * 各クローラーで共通して使用するGCS保存・読み込み機能
 */

import { saveHtmlToGcs, saveJsonToGcs, downloadFromGcs, checkGoogleApiConfig } from './google-apis';
import * as crypto from 'crypto';

// GCS保存が有効かどうか
let gcsEnabled: boolean | null = null;

/**
 * GCS機能が利用可能かチェック
 */
export function isGcsEnabled(): boolean {
  if (gcsEnabled === null) {
    const config = checkGoogleApiConfig();
    gcsEnabled = config.cloudStorage;
    if (!gcsEnabled) {
      console.warn('[GCS] Cloud Storage is not configured. Data will be stored in database only.');
    }
  }
  return gcsEnabled;
}

/**
 * HTMLコンテンツのハッシュを計算
 */
export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * HTMLデータを保存（GCS優先、フォールバックあり）
 * @returns { gcsUrl, htmlContent } - GCS保存時はhtmlContentがnull
 */
export async function saveRawHtml(
  source: string,
  productId: string,
  html: string,
  options: { forceDb?: boolean } = {},
): Promise<{ gcsUrl: string | null; htmlContent: string | null }> {
  // GCSに保存を試みる
  if (!options.forceDb && isGcsEnabled()) {
    try {
      const gcsUrl = await saveHtmlToGcs(source.toLowerCase(), productId, html);
      if (gcsUrl) {
        return { gcsUrl, htmlContent: null };
      }
    } catch (error) {
      console.error(`[GCS] Failed to save HTML for ${source}/${productId}:`, error);
    }
  }

  // GCS保存失敗またはGCS無効時はDBに保存
  return { gcsUrl: null, htmlContent: html };
}

/**
 * JSONデータを保存（GCS優先、フォールバックあり）
 * @returns { gcsUrl, rawData } - GCS保存時はrawDataがnull
 */
export async function saveRawJson(
  source: string,
  productId: string,
  data: object,
  options: { forceDb?: boolean } = {},
): Promise<{ gcsUrl: string | null; rawData: object | null }> {
  // GCSに保存を試みる
  if (!options.forceDb && isGcsEnabled()) {
    try {
      const gcsUrl = await saveJsonToGcs(source.toLowerCase(), productId, data);
      if (gcsUrl) {
        return { gcsUrl, rawData: null };
      }
    } catch (error) {
      console.error(`[GCS] Failed to save JSON for ${source}/${productId}:`, error);
    }
  }

  // GCS保存失敗またはGCS無効時はDBに保存
  return { gcsUrl: null, rawData: data };
}

/**
 * 保存済みデータを取得（GCSまたはDB）
 * @param gcsUrl GCS URL（nullの場合はDBから取得を想定）
 * @param dbContent DBに保存されたコンテンツ
 */
export async function getRawContent(gcsUrl: string | null, dbContent: string | null): Promise<string | null> {
  // GCS URLがある場合はGCSから取得
  if (gcsUrl) {
    try {
      const content = await downloadFromGcs(gcsUrl);
      if (content) {
        return content;
      }
      console.warn(`[GCS] Failed to download from ${gcsUrl}, falling back to DB`);
    } catch (error) {
      console.error(`[GCS] Download error:`, error);
    }
  }

  // GCSから取得できない場合はDBのデータを返す
  return dbContent;
}

/**
 * クローラー統計用のログ出力
 */
export function logGcsStats(stats: { total: number; gcsSuccess: number; dbFallback: number; errors: number }) {
  console.log('\n=== GCS Storage Stats ===');
  console.log(`Total processed: ${stats.total}`);
  console.log(`GCS saved: ${stats.gcsSuccess} (${((stats.gcsSuccess / stats.total) * 100).toFixed(1)}%)`);
  console.log(`DB fallback: ${stats.dbFallback}`);
  console.log(`Errors: ${stats.errors}`);
}

/**
 * クローラー用のデータ保存ラッパー
 * 使用例:
 * ```
 * const { gcsUrl, htmlContent } = await saveRawHtml('mgs', productId, html);
 * await db['insert'](rawHtmlData).values({
 *   source: 'MGS',
 *   productId,
 *   url,
 *   htmlContent,
 *   gcsUrl,
 *   hash: calculateHash(html),
 * });
 * ```
 */
export const crawlerGcsHelper = {
  isGcsEnabled,
  calculateHash,
  saveRawHtml,
  saveRawJson,
  getRawContent,
  logGcsStats,
};

export default crawlerGcsHelper;
