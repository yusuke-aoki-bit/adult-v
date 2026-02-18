/**
 * ユーザー修正提案API（個別）
 * PUT: 修正提案の審査（管理者用）
 * DELETE: 修正提案削除（投稿者のみ、pending状態のみ）
 */

import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { userCorrections, userContributionStats } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  createUserCorrectionsReviewHandler,
  createUserCorrectionsDeleteHandler,
} from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

const reviewHandler = createUserCorrectionsReviewHandler({
  getDb,
  userCorrections,
  userContributionStats,
  eq,
  and,
  desc: () => {},
  sql,
});

const deleteHandler = createUserCorrectionsDeleteHandler({
  getDb,
  userCorrections,
  userContributionStats,
  eq,
  and,
  desc: () => {},
  sql,
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return reviewHandler(request, { params });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return deleteHandler(request, { params });
}
