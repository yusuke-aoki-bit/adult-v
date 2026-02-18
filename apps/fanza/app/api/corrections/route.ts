/**
 * ユーザー修正提案API
 * GET: 修正提案一覧取得
 * POST: 修正提案作成
 */

import { getDb } from '@/lib/db';
import { userCorrections, userContributionStats } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  createUserCorrectionsGetHandler,
  createUserCorrectionsPostHandler,
} from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createUserCorrectionsGetHandler({
  getDb,
  userCorrections,
  userContributionStats,
  eq,
  and,
  desc,
  sql,
});

export const POST = createUserCorrectionsPostHandler({
  getDb,
  userCorrections,
  userContributionStats,
  eq,
  and,
  desc,
  sql,
});
