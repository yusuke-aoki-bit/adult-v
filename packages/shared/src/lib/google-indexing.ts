/**
 * Google Indexing API 統合
 *
 * 新規・更新コンテンツをGoogleに即座にインデックス登録をリクエスト
 *
 * 前提条件:
 *   - Search Consoleでサイトの所有権を確認済み
 *   - サービスアカウントにSearch Consoleオーナー権限を付与
 *   - GOOGLE_SERVICE_ACCOUNT_KEY_FILE が設定されていること
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/indexing'];

export interface IndexingResult {
  url: string;
  type: 'URL_UPDATED' | 'URL_DELETED';
  success: boolean;
  error?: string;
}

/**
 * サービスアカウント認証クライアントを取得
 */
async function getAuthClient() {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  if (!keyFilePath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_FILE が設定されていません');
  }

  const fullPath = path.resolve(keyFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`サービスアカウントキーファイルが見つかりません: ${fullPath}`);
  }

  const keyFile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: SCOPES,
  });

  await auth.authorize();
  return auth;
}

/**
 * URLをGoogleにインデックス登録リクエスト
 */
export async function requestIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
): Promise<IndexingResult> {
  try {
    const auth = await getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    console.log(`[Indexing API] ✅ ${type}: ${url}`);
    return { url, type, success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Indexing API] ❌ ${type} failed for ${url}:`, errorMessage);
    return { url, type, success: false, error: errorMessage };
  }
}

/**
 * 複数URLを一括でインデックス登録リクエスト
 */
export async function requestBatchIndexing(
  urls: string[],
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
  delayMs: number = 100,
): Promise<IndexingResult[]> {
  const results: IndexingResult[] = [];

  for (const url of urls) {
    const result = await requestIndexing(url, type);
    results.push(result);

    // レート制限対策
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * 新規商品のURLをインデックス登録
 * URLは /ja/products/... 形式（日本語をデフォルトとして）
 */
export async function indexNewProducts(productSlugs: string[], siteUrl: string): Promise<IndexingResult[]> {
  const urls = productSlugs.map((slug) => `${siteUrl}/ja/products/${slug}`);
  return requestBatchIndexing(urls, 'URL_UPDATED');
}

/**
 * 新規演者のURLをインデックス登録
 * URLは /ja/actress/... 形式（日本語をデフォルトとして）
 */
export async function indexNewPerformers(performerSlugs: string[], siteUrl: string): Promise<IndexingResult[]> {
  const urls = performerSlugs.map((slug) => `${siteUrl}/ja/actress/${slug}`);
  return requestBatchIndexing(urls, 'URL_UPDATED');
}

/**
 * インデックス登録の設定確認
 */
export function checkIndexingApiConfig(): boolean {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  return !!keyFile && fs.existsSync(path.resolve(keyFile));
}
