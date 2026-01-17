/**
 * レビュー補填 API エンドポイント
 *
 * DUGAの過去商品に対してレビュー情報を補填取得
 * GET /api/cron/backfill-reviews?limit=50&minReviews=1&force=false
 *
 * パラメータ:
 * - limit: 処理する商品数（デフォルト: 50）
 * - minReviews: 最低レビュー数フィルター（デフォルト: 0）
 * - force: 既存データも再取得するか（デフォルト: false）
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createBackfillReviewsHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createBackfillReviewsHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
