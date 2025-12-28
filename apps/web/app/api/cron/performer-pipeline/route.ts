/**
 * 演者名寄せ統合パイプライン Cron API
 *
 * Cloud Schedulerから定期的に呼び出される
 * Wikiクロール + 演者紐付けを一括で実行
 *
 * GET /api/cron/performer-pipeline?asp=MGS&limit=500
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createPerformerPipelineHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createPerformerPipelineHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
