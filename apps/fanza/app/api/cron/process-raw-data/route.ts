/**
 * Raw Data 処理 API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * raw_html_dataテーブルの未処理データを処理
 * GET /api/cron/process-raw-data
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createProcessRawDataHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createProcessRawDataHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
