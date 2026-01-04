/**
 * ユーザータグ提案APIハンドラー
 * タグの提案・取得・投票を処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { moderateTagSuggestion, type ContentModerationResult } from '../lib/llm-service';
import { createApiErrorResponse, logApiWarning } from '../lib/api-logger';

// 型定義
export interface UserTagSuggestion {
  id: number;
  productId: number;
  userId: string;
  suggestedTagName: string;
  existingTagId: number | null;
  upvotes: number | null;
  downvotes: number | null;
  status: string;
  createdAt: Date;
}

export interface UserTagSuggestionWithVote extends UserTagSuggestion {
  userVote?: 'up' | 'down' | null;
}

// 依存性の型定義
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UserTagSuggestionsHandlerDeps {
  getDb: () => unknown;
  userTagSuggestions: unknown;
  userTagVotes: unknown;
  products: unknown;
  tags: unknown;
  eq: (a: any, b: any) => unknown;
  and: (...args: any[]) => unknown;
  desc: (col: any) => unknown;
  sql: unknown;
}

// タグ提案取得ハンドラー
export function createUserTagSuggestionsGetHandler(deps: UserTagSuggestionsHandlerDeps) {
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
      const suggestionsTable = deps.userTagSuggestions as any;

      // 承認済みまたはpending のタグ提案を取得
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
        .orderBy(deps.desc(suggestionsTable.upvotes)) as UserTagSuggestion[];

      // ユーザーIDがあれば投票状態も取得
      let suggestionsWithVotes: UserTagSuggestionWithVote[] = suggestions;

      if (userId && suggestions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const votesTable = deps.userTagVotes as any;
        const suggestionIds = suggestions.map(s => s.id);

        const votes = await db
          .select()
          .from(votesTable)
          .where(
            deps.and(
              deps.eq(votesTable.voterId, userId),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deps.sql as any)`${votesTable.suggestionId} IN (${suggestionIds.join(',')})`
            )
          )
          .orderBy(deps.desc(votesTable.createdAt)) as { suggestionId: number; voteType: string }[];

        const voteMap = new Map(votes.map(v => [v.suggestionId, v.voteType as 'up' | 'down']));

        suggestionsWithVotes = suggestions.map(suggestion => ({
          ...suggestion,
          userVote: voteMap.get(suggestion.id) || null,
        }));
      }

      return NextResponse.json({
        suggestions: suggestionsWithVotes,
        total: suggestionsWithVotes.length,
      });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch tag suggestions', 500, {
        endpoint: '/api/products/[id]/tag-suggestions',
      });
    }
  };
}

// タグ提案投稿ハンドラー
export function createUserTagSuggestionsPostHandler(deps: UserTagSuggestionsHandlerDeps) {
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
      const { userId, tagName } = body;

      // バリデーション
      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      if (!tagName || tagName.length < 2 || tagName.length > 50) {
        return NextResponse.json({ error: 'Tag name must be between 2 and 50 characters' }, { status: 400 });
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
      const suggestionsTable = deps.userTagSuggestions as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productsTable = deps.products as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tagsTable = deps.tags as any;

      // 商品が存在するか確認
      const [product] = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(deps.eq(productsTable.id, productId))
        .limit(1) as { id: number; title: string }[];

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // 同じタグ提案が既に存在するかチェック
      const [existingSuggestion] = await db
        .select()
        .from(suggestionsTable)
        .where(
          deps.and(
            deps.eq(suggestionsTable.productId, productId),
            deps.eq(suggestionsTable.suggestedTagName, tagName)
          )
        )
        .limit(1) as UserTagSuggestion[];

      if (existingSuggestion) {
        return NextResponse.json({ error: 'This tag has already been suggested' }, { status: 409 });
      }

      // 既存タグとマッチするか確認
      const [existingTag] = await db
        .select({ id: tagsTable.id })
        .from(tagsTable)
        .where(deps.eq(tagsTable.name, tagName))
        .limit(1) as { id: number }[];

      // 既存タグを取得（AI審査用）
      const existingTags = await db
        .select({ name: tagsTable.name })
        .from(tagsTable)
        .where(deps.eq(tagsTable.id, tagsTable.id)) // 全て取得
        .limit(100) as { name: string }[];

      // AI審査を実行
      let moderationResult: ContentModerationResult | null = null;
      let status = 'pending';
      let moderationReason: string | null = null;
      let moderatedBy: string | null = null;

      try {
        moderationResult = await moderateTagSuggestion({
          productTitle: product.title,
          suggestedTag: tagName,
          existingTags: existingTags.map(t => t.name),
          availableTags: existingTags.map(t => t.name),
        });

        if (moderationResult) {
          if (moderationResult.decision === 'approve') {
            status = 'approved';
            moderatedBy = 'ai';
          } else if (moderationResult.decision === 'reject') {
            status = 'rejected';
            moderationReason = moderationResult.reason;
            moderatedBy = 'ai';
          }
        }
      } catch (moderationError) {
        logApiWarning(moderationError, 'UserTagSuggestions moderation');
      }

      // タグ提案を保存
      const [newSuggestion] = await db
        .insert(suggestionsTable)
        .values({
          productId,
          userId,
          suggestedTagName: tagName,
          existingTagId: existingTag?.id || null,
          upvotes: 1, // 提案者自身の票
          downvotes: 0,
          status,
          moderationReason,
          moderatedAt: status !== 'pending' ? new Date() : null,
          moderatedBy,
        })
        .returning() as UserTagSuggestion[];

      return NextResponse.json({
        suggestion: newSuggestion,
        moderation: moderationResult ? {
          decision: moderationResult.decision,
          reason: moderationResult.reason,
        } : null,
      }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to create tag suggestion', 500, {
        endpoint: '/api/products/[id]/tag-suggestions',
      });
    }
  };
}

// タグ提案投票ハンドラー
export function createUserTagVoteHandler(deps: UserTagSuggestionsHandlerDeps) {
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
      const suggestionsTable = deps.userTagSuggestions as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const votesTable = deps.userTagVotes as any;

      // 提案が存在するか確認
      const [suggestion] = await db
        .select()
        .from(suggestionsTable)
        .where(deps.eq(suggestionsTable.id, suggestionId))
        .limit(1) as UserTagSuggestion[];

      if (!suggestion) {
        return NextResponse.json({ error: 'Tag suggestion not found' }, { status: 404 });
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
        endpoint: '/api/products/[id]/tag-suggestions/vote',
      });
    }
  };
}
