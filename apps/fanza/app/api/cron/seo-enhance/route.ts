/**
 * SEO/分析強化 Cron API エンドポイント
 *
 * Google APIs を使用してSEO・分析を強化:
 * - Indexing API: URLの即時インデックス登録リクエスト
 * - Analytics Data API: アクセス解析データ取得・キャッシュ
 *
 * GET /api/cron/seo-enhance?type=indexing|analytics&limit=100
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import {
  requestIndexing,
  getAnalyticsReport,
  checkGoogleApiConfig,
} from '@/lib/google-apis';
import { createSeoEnhanceHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createSeoEnhanceHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  requestIndexing,
  getAnalyticsReport,
  checkGoogleApiConfig,
});
