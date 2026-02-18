/**
 * ユーザー演者提案APIハンドラー
 * 作品に出演している演者の提案・取得・投票を処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

// 型定義
export interface UserPerformerSuggestion {
  id: number;
  productId: number;
  userId: string;
  performerName: string;
  existingPerformerId: number | null;
  upvotes: number | null;
  downvotes: number | null;
  status: string;
  createdAt: Date;
}

export interface UserPerformerSuggestionWithVote extends UserPerformerSuggestion {
  userVote?: 'up' | 'down' | null;
}

// 依存性の型定義（DI境界のため関数パラメータはany - TypeScript共変/反変制約）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UserPerformerSuggestionsHandlerDeps {
  getDb: () => any;
  userPerformerSuggestions: unknown;
  userPerformerVotes: unknown;
  products: unknown;
  performers: unknown;
  eq: (a: any, b: any) => any;
  and: (...args: any[]) => any;
  or: (...args: any[]) => any;
  desc: (col: any) => any;
  ilike: (col: any, pattern: string) => any;
  sql: any;
}

// 演者提案取得ハンドラー
export function createUserPerformerSuggestionsGetHandler(deps: UserPerformerSuggestionsHandlerDeps) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const productId = parseInt(id, 10);

      if (isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const userId = searchParams.get('userId');

      const db = deps.getDb() as {
        select: (cols?: Record<string, unknown>) => {
          from: (table: unknown) => {
            where: (condition: unknown) => {
              orderBy: (order: unknown) => Promise<unknown[]>;
            };
          };
        };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionsTable = deps.userPerformerSuggestions as any;

      // 承認済みまたはpending の演者提案を取得
      const suggestions = await db
        .select()
        .from(suggestionsTable)
        .where(
          deps.and(
            deps.eq(suggestionsTable.productId, productId),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (deps.sql as any)`${suggestionsTable.status} IN ('approved', 'pending')`
          )
        )
        .orderBy(deps.desc(suggestionsTable.upvotes)) as UserPerformerSuggestion[];

      // ユーザーIDがあれば投票状態も取得
      let suggestionsWithVotes: UserPerformerSuggestionWithVote[] = suggestions;

      if (userId && suggestions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const votesTable = deps.userPerformerVotes as any;
        const suggestionIds = suggestions.map(s => s.id);

        const votes = await db
          .select()
          .from(votesTable)
          .where(
            deps.and(
              deps.eq(votesTable.voterId, userId),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deps.sql as any)`${votesTable.suggestionId} IN (${(deps.sql as any).join(suggestionIds.map((id: number) => (deps.sql as any)`${id}`), (deps.sql as any)`, `)})`
            )
          )
          .orderBy(deps.desc(votesTable.createdAt)) as { suggestionId: number; voteType: string }[];

        const voteMap = new Map(votes.map(v => [v.suggestionId, v.voteType as 'up' | 'down']));

        suggestionsWithVotes = suggestions.map(suggestion => ({
          ...suggestion,
          userVote: voteMap.get(suggestion['id']) || null,
        }));
      }

      return NextResponse.json({
        suggestions: suggestionsWithVotes,
        total: suggestionsWithVotes.length,
      });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch performer suggestions', 500, {
        endpoint: '/api/products/[id]/performer-suggestions',
      });
    }
  };
}

// 演者提案投稿ハンドラー
export function createUserPerformerSuggestionsPostHandler(deps: UserPerformerSuggestionsHandlerDeps) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const productId = parseInt(id, 10);

      if (isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
      }

      const body = await req.json();
      const { userId, performerName } = body;

      // バリデーション
      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      if (!performerName || performerName.length < 2 || performerName.length > 100) {
        return NextResponse.json({ error: 'Performer name must be between 2 and 100 characters' }, { status: 400 });
      }

      const db = deps.getDb() as {
        select: (cols?: Record<string, unknown>) => {
          from: (table: unknown) => {
            where: (condition: unknown) => {
              limit: (n: number) => Promise<unknown[]>;
            };
          };
        };
        insert: (table: unknown) => {
          values: (values: unknown) => {
            returning: () => Promise<unknown[]>;
          };
        };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionsTable = deps.userPerformerSuggestions as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productsTable = deps.products as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const performersTable = deps.performers as any;

      // 商品が存在するか確認
      const [product] = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(deps.eq(productsTable.id, productId))
        .limit(1) as { id: number; title: string }[];

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // 同じ演者提案が既に存在するかチェック
      const [existingSuggestion] = await db
        .select()
        .from(suggestionsTable)
        .where(
          deps.and(
            deps.eq(suggestionsTable.productId, productId),
            deps.eq(suggestionsTable.performerName, performerName)
          )
        )
        .limit(1) as UserPerformerSuggestion[];

      if (existingSuggestion) {
        return NextResponse.json({ error: 'This performer has already been suggested' }, { status: 409 });
      }

      // 既存の演者とマッチするか確認（部分一致）
      const [existingPerformer] = await db
        .select({ id: performersTable.id, name: performersTable.name })
        .from(performersTable)
        .where(
          deps.or(
            deps.eq(performersTable.name, performerName),
            deps.ilike(performersTable.name, `%${performerName}%`)
          )
        )
        .limit(1) as { id: number; name: string }[];

      // 演者提案は基本的に pending（人間による確認が必要）
      const status = 'pending';

      // 演者提案を保存
      const [newSuggestion] = await db
        .insert(suggestionsTable)
        .values({
          productId,
          userId,
          performerName,
          existingPerformerId: existingPerformer?.id || null,
          upvotes: 1, // 提案者自身の票
          downvotes: 0,
          status,
        })
        .returning() as UserPerformerSuggestion[];

      return NextResponse.json({
        suggestion: newSuggestion,
        matchedPerformer: existingPerformer || null,
      }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to create performer suggestion', 500, {
        endpoint: '/api/products/[id]/performer-suggestions',
      });
    }
  };
}

// 演者提案投票ハンドラー
export function createUserPerformerVoteHandler(deps: UserPerformerSuggestionsHandlerDeps) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; suggestionId: string }> }
  ): Promise<NextResponse> => {
    try {
      const { suggestionId: suggestionIdStr } = await params;
      const suggestionId = parseInt(suggestionIdStr, 10);

      if (isNaN(suggestionId)) {
        return NextResponse.json({ error: 'Invalid suggestion ID' }, { status: 400 });
      }

      const body = await req.json();
      const { userId, voteType } = body;

      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      if (!['up', 'down'].includes(voteType)) {
        return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
      }

      const db = deps.getDb() as {
        select: (cols?: Record<string, unknown>) => {
          from: (table: unknown) => {
            where: (condition: unknown) => {
              limit: (n: number) => Promise<unknown[]>;
            };
          };
        };
        insert: (table: unknown) => {
          values: (values: unknown) => {
            onConflictDoUpdate: (config: unknown) => {
              returning: () => Promise<unknown[]>;
            };
          };
        };
        update: (table: unknown) => {
          set: (values: unknown) => {
            where: (condition: unknown) => Promise<unknown>;
          };
        };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionsTable = deps.userPerformerSuggestions as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const votesTable = deps.userPerformerVotes as any;

      // 提案が存在するか確認
      const [suggestion] = await db
        .select()
        .from(suggestionsTable)
        .where(deps.eq(suggestionsTable.id, suggestionId))
        .limit(1) as UserPerformerSuggestion[];

      if (!suggestion) {
        return NextResponse.json({ error: 'Performer suggestion not found' }, { status: 404 });
      }

      // 既存の投票を確認
      const [existingVote] = await db
        .select()
        .from(votesTable)
        .where(
          deps.and(
            deps.eq(votesTable.suggestionId, suggestionId),
            deps.eq(votesTable.voterId, userId)
          )
        )
        .limit(1) as { suggestionId: number; voterId: string; voteType: string }[];

      // 投票を更新または挿入
      await db
        .insert(votesTable)
        .values({
          suggestionId,
          voterId: userId,
          voteType,
        })
        .onConflictDoUpdate({
          target: [votesTable.suggestionId, votesTable.voterId],
          set: { voteType },
        });

      // upvotes/downvotes を更新
      const oldVote = existingVote?.voteType;
      const newVote = voteType;

      if (oldVote !== newVote) {
        // 古い投票を減らす
        if (oldVote === 'up') {
          await db
            .update(suggestionsTable)
            .set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              upvotes: (deps.sql as any)`GREATEST(COALESCE(${suggestionsTable.upvotes}, 0) - 1, 0)`,
            })
            .where(deps.eq(suggestionsTable.id, suggestionId));
        } else if (oldVote === 'down') {
          await db
            .update(suggestionsTable)
            .set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              downvotes: (deps.sql as any)`GREATEST(COALESCE(${suggestionsTable.downvotes}, 0) - 1, 0)`,
            })
            .where(deps.eq(suggestionsTable.id, suggestionId));
        }

        // 新しい投票を増やす
        if (newVote === 'up') {
          await db
            .update(suggestionsTable)
            .set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              upvotes: (deps.sql as any)`COALESCE(${suggestionsTable.upvotes}, 0) + 1`,
            })
            .where(deps.eq(suggestionsTable.id, suggestionId));
        } else if (newVote === 'down') {
          await db
            .update(suggestionsTable)
            .set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              downvotes: (deps.sql as any)`COALESCE(${suggestionsTable.downvotes}, 0) + 1`,
            })
            .where(deps.eq(suggestionsTable.id, suggestionId));
        }
      }

      return NextResponse.json({ success: true, voteType });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to vote', 500, {
        endpoint: '/api/products/[id]/performer-suggestions/vote',
      });
    }
  };
}
