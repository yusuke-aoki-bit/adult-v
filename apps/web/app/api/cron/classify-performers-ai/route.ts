/**
 * AI演者分類 API Route
 *
 * GET /api/cron/classify-performers-ai?limit=50
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createClassifyPerformersAiHandler } from '@adult-v/shared/cron-handlers';
import { classifyPerformerByProducts } from '@adult-v/shared/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createClassifyPerformersAiHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  classifyPerformerByProducts,
});
