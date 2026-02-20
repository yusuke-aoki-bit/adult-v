/**
 * オンデマンド再検証 API エンドポイント
 *
 * クローラー完了後に呼び出してISRキャッシュを即座に無効化
 * GET  /api/cron/revalidate
 * POST /api/cron/revalidate { "paths": ["/products/123", "/"] }
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { createRevalidateHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';

const handler = createRevalidateHandler({
  verifyCronRequest,
  unauthorizedResponse,
});

export const GET = handler;
export const POST = handler;
