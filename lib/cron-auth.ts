/**
 * Cloud Scheduler認証ヘルパー
 *
 * Cloud SchedulerからのリクエストにはOIDCトークンが含まれる。
 * 開発環境ではシークレットキーでも認証可能。
 */

import { NextRequest } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret-key';

/**
 * Cloud Schedulerからのリクエストを認証
 */
export function verifyCronRequest(request: NextRequest): boolean {
  // 1. Authorization ヘッダーをチェック（Cloud Scheduler OIDC）
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Cloud Runの場合、OIDCトークンは自動検証される
    // ここでは単にトークンの存在確認のみ
    return true;
  }

  // 2. X-Cron-Secret ヘッダーをチェック（開発/テスト用）
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret === CRON_SECRET) {
    return true;
  }

  // 3. クエリパラメータをチェック（緊急用）
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');
  if (secretParam === CRON_SECRET) {
    return true;
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
