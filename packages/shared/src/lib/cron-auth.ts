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

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env['CRON_SECRET'];
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

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
  const url = new URL(request['url']);
  if (url.searchParams.has('secret')) {
    console.error('[cron-auth] Query parameter auth attempted - this is not allowed');
  }

  return false;
}

/**
 * 認証エラーレスポンスを生成
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ============================================================
// Admin API認証
// ============================================================

const ADMIN_SECRET = process.env['ADMIN_SECRET'];

/**
 * Admin APIリクエストを認証
 * X-Admin-Secret ヘッダーまたは Authorization: Bearer トークンをチェック
 */
export function verifyAdminRequest(request: NextRequest): boolean {
  // 1. Authorization ヘッダーをチェック
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && ADMIN_SECRET) {
    const token = authHeader.slice(7);
    if (token === ADMIN_SECRET) {
      return true;
    }
  }

  // 2. X-Admin-Secret ヘッダーをチェック
  if (ADMIN_SECRET) {
    const adminSecret = request.headers.get('x-admin-secret');
    if (adminSecret === ADMIN_SECRET) {
      return true;
    }
  }

  // 3. 開発環境では緩和（オプション）
  if (!IS_PRODUCTION && !ADMIN_SECRET) {
    console.warn('[admin-auth] No ADMIN_SECRET set in dev mode, allowing request');
    return true;
  }

  return false;
}

// ============================================================
// 認証ミドルウェアヘルパー
// ============================================================

export type AuthType = 'cron' | 'admin' | 'public';

/**
 * 認証タイプに基づいてリクエストを検証
 */
export function verifyRequest(request: NextRequest, authType: AuthType): boolean {
  switch (authType) {
    case 'cron':
      return verifyCronRequest(request);
    case 'admin':
      return verifyAdminRequest(request);
    case 'public':
      return true;
    default:
      return false;
  }
}

/**
 * 認証付きAPIハンドラーを作成
 */
export function withAuth<T>(
  authType: AuthType,
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
): (request: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return async (request: NextRequest) => {
    if (!verifyRequest(request, authType)) {
      return unauthorizedResponse() as NextResponse<{ error: string }>;
    }
    return handler(request);
  };
}

/**
 * 認証エラーをスロー
 */
export function requireAuth(request: NextRequest, authType: AuthType): void {
  if (!verifyRequest(request, authType)) {
    throw new Error('Unauthorized');
  }
}
