/**
 * ニュース自動生成 Cron エンドポイント
 *
 * 毎日6:00 JST実行
 * GET /api/cron/generate-news
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createGenerateNewsHandler } from '@adult-v/shared/cron-handlers';
import { generateNewsContent } from '@adult-v/shared/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createGenerateNewsHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  generateNewsContent,
});
