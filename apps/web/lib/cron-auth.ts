/**
 * Cloud Scheduler認証ヘルパー
 *
 * Cloud SchedulerからのリクエストにはOIDCトークンが含まれる。
 * 開発環境ではヘッダーベースのシークレットキーでも認証可能。
 *
 * セキュリティ注意:
 * - クエリパラメータでの認証はURLに機密情報が露出するため禁止
 * - 本番環境ではOIDC認証のみを使用すべき
 */

import { NextRequest } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Cloud Schedulerからのリクエストを認証
 */
export function verifyCronRequest(request: NextRequest): boolean {
  // 1. Authorization ヘッダーをチェック（Cloud Scheduler OIDC）
  // 本番環境ではこれが主要な認証方法
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Cloud Runの場合、OIDCトークンは自動検証される
    // ここでは単にトークンの存在確認のみ
    return true;
  }

  // 2. X-Cron-Secret ヘッダーをチェック（開発/テスト用）
  // 本番環境ではOIDCが必須なので、この方法は開発環境のみ
  if (!IS_PRODUCTION && CRON_SECRET) {
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret === CRON_SECRET) {
      console.warn('[cron-auth] Using header-based auth (dev mode only)');
      return true;
    }
  }

  // セキュリティ: クエリパラメータでの認証は禁止
  // URLに機密情報が露出するリスクがあるため
  const url = new URL(request.url);
  if (url.searchParams.has('secret')) {
    console.error('[cron-auth] Query parameter auth attempted - this is not allowed');
  }

  return false;
}

/**
 * 認証エラーレスポンスを生成
 */
export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
