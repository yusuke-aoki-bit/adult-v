import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

// Types for dependency injection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UserCorrectionsHandlerDeps {
  getDb: () => unknown;
  userCorrections: unknown;
  userContributionStats: unknown;
  eq: (column: any, value: any) => any;
  and: (...conditions: any[]) => any;
  desc: (column: any) => any;
  sql: any;
}

export interface UserCorrection {
  id: number;
  targetType: 'product' | 'performer';
  targetId: number;
  userId: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// GET handler - 修正提案一覧取得
export function createUserCorrectionsGetHandler(deps: UserCorrectionsHandlerDeps) {
  return async (request: NextRequest, context?: { params?: { targetType?: string; targetId?: string } }) => {
    const { getDb, userCorrections, eq, and, desc } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const { searchParams } = new URL(request.url);
      const targetType = context?.params?.targetType || searchParams.get('targetType');
      const targetId = context?.params?.targetId || searchParams.get('targetId');
      const userId = searchParams.get('userId');
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;

      // 条件構築
      const conditions: unknown[] = [];

      if (targetType) {
        conditions.push(eq((userCorrections as Record<string, unknown>).targetType, targetType));
      }
      if (targetId) {
        conditions.push(eq((userCorrections as Record<string, unknown>).targetId, parseInt(targetId, 10)));
      }
      if (userId) {
        conditions.push(eq((userCorrections as Record<string, unknown>).userId, userId));
      }
      if (status) {
        conditions.push(eq((userCorrections as Record<string, unknown>).status, status));
      }

      let query = (db.select as CallableFunction)({
        id: (userCorrections as Record<string, unknown>).id,
        targetType: (userCorrections as Record<string, unknown>).targetType,
        targetId: (userCorrections as Record<string, unknown>).targetId,
        userId: (userCorrections as Record<string, unknown>).userId,
        fieldName: (userCorrections as Record<string, unknown>).fieldName,
        currentValue: (userCorrections as Record<string, unknown>).currentValue,
        suggestedValue: (userCorrections as Record<string, unknown>).suggestedValue,
        reason: (userCorrections as Record<string, unknown>).reason,
        status: (userCorrections as Record<string, unknown>).status,
        reviewedBy: (userCorrections as Record<string, unknown>).reviewedBy,
        reviewedAt: (userCorrections as Record<string, unknown>).reviewedAt,
        createdAt: (userCorrections as Record<string, unknown>).createdAt,
      }).from(userCorrections);

      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }

      const corrections = await query
        .orderBy(desc((userCorrections as Record<string, unknown>).createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ corrections });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch corrections', 500, {
        endpoint: '/api/corrections',
      });
    }
  };
}

// POST handler - 修正提案作成
export function createUserCorrectionsPostHandler(deps: UserCorrectionsHandlerDeps) {
  return async (request: NextRequest) => {
    const { getDb, userCorrections, userContributionStats, eq, sql } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const body = await request.json();
      const { userId, targetType, targetId, fieldName, currentValue, suggestedValue, reason } = body;

      // バリデーション
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }
      if (!targetType || !['product', 'performer'].includes(targetType)) {
        return NextResponse.json({ error: 'Invalid target type' }, { status: 400 });
      }
      if (!targetId) {
        return NextResponse.json({ error: 'Target ID required' }, { status: 400 });
      }
      if (!fieldName) {
        return NextResponse.json({ error: 'Field name required' }, { status: 400 });
      }
      if (!suggestedValue || suggestedValue.trim().length === 0) {
        return NextResponse.json({ error: 'Suggested value required' }, { status: 400 });
      }

      // 提案作成
      const result = await (db.insert as CallableFunction)(userCorrections)
        .values({
          userId,
          targetType,
          targetId: parseInt(targetId, 10),
          fieldName,
          currentValue: currentValue || null,
          suggestedValue: suggestedValue.trim(),
          reason: reason?.trim() || null,
          status: 'pending',
        })
        .returning();

      // 貢献度更新
      await (db.insert as CallableFunction)(userContributionStats)
        .values({
          userId,
          correctionCount: 1,
        })
        .onConflictDoUpdate({
          target: (userContributionStats as Record<string, unknown>).userId,
          set: {
            correctionCount: (sql as CallableFunction)`${(userContributionStats as Record<string, unknown>).correctionCount} + 1`,
            updatedAt: new Date(),
          },
        });

      return NextResponse.json({ correction: result[0] }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to create correction', 500, {
        endpoint: '/api/corrections',
      });
    }
  };
}

// PUT handler - 修正提案の審査（管理者用）
export function createUserCorrectionsReviewHandler(deps: UserCorrectionsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, userCorrections, userContributionStats, eq, sql } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const correctionId = parseInt(context.params.id, 10);
      const body = await request.json();
      const { reviewerId, status } = body;

      // バリデーション
      if (!reviewerId) {
        return NextResponse.json({ error: 'Reviewer ID required' }, { status: 401 });
      }
      if (!status || !['approved', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      // 既存の提案を取得
      const existing = await (db.select as CallableFunction)()
        .from(userCorrections)
        .where(eq((userCorrections as Record<string, unknown>).id, correctionId))
        .limit(1);

      if (existing.length === 0) {
        return NextResponse.json({ error: 'Correction not found' }, { status: 404 });
      }

      const correction = existing[0] as UserCorrection;
      if (correction.status !== 'pending') {
        return NextResponse.json({ error: 'Correction already reviewed' }, { status: 400 });
      }

      // 審査結果を更新
      const result = await (db.update as CallableFunction)(userCorrections)
        .set({
          status,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq((userCorrections as Record<string, unknown>).id, correctionId))
        .returning();

      // 承認された場合、貢献度を更新
      if (status === 'approved') {
        await (db.update as CallableFunction)(userContributionStats)
          .set({
            correctionApprovedCount: (sql as CallableFunction)`${(userContributionStats as Record<string, unknown>).correctionApprovedCount} + 1`,
            contributionScore: (sql as CallableFunction)`${(userContributionStats as Record<string, unknown>).contributionScore} + 10`,
            updatedAt: new Date(),
          })
          .where(eq((userContributionStats as Record<string, unknown>).userId, correction.userId));
      }

      return NextResponse.json({ correction: result[0] });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to review correction', 500, {
        endpoint: '/api/corrections/review',
      });
    }
  };
}

// DELETE handler - 修正提案削除（投稿者のみ、pending状態のみ）
export function createUserCorrectionsDeleteHandler(deps: UserCorrectionsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, userCorrections, userContributionStats, eq, and, sql } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const correctionId = parseInt(context.params.id, 10);
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      // pending状態の自分の提案のみ削除可能
      const result = await (db.delete as CallableFunction)(userCorrections)
        .where(and(
          eq((userCorrections as Record<string, unknown>).id, correctionId),
          eq((userCorrections as Record<string, unknown>).userId, userId),
          eq((userCorrections as Record<string, unknown>).status, 'pending')
        ))
        .returning();

      if (result.length === 0) {
        return NextResponse.json({ error: 'Correction not found or cannot be deleted' }, { status: 404 });
      }

      // 貢献度を減らす
      await (db.update as CallableFunction)(userContributionStats)
        .set({
          correctionCount: (sql as CallableFunction)`GREATEST(${(userContributionStats as Record<string, unknown>).correctionCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq((userContributionStats as Record<string, unknown>).userId, userId));

      return NextResponse.json({ success: true });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to delete correction', 500, {
        endpoint: '/api/corrections',
      });
    }
  };
}
