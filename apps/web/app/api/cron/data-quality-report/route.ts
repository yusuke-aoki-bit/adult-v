/**
 * データ品質レポート API エンドポイント
 *
 * GET /api/cron/data-quality-report
 *
 * データの補充率・欠損状況を詳細にレポート
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createDataQualityReportHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';

export const GET = createDataQualityReportHandler({
  getDb,
  sql,
});
