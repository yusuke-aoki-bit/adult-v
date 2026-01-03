/**
 * ユーザーレビューAPIハンドラー
 * レビューの投稿・取得・投票を処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { moderateUserReview, type ContentModerationResult } from '../lib/llm-service';

// 型定義
export interface UserReview {
  id: number;
  productId: number;
  userId: string;
  rating: string;
  title: string | null;
  content: string;
  helpfulCount: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserReviewWithVote extends UserReview {
  userVote?: 'helpful' | 'not_helpful' | null;
}

// 依存性の型定義
export interface UserReviewsHandlerDeps {
  getDb: () => unknown;
  userReviews: unknown;
  userReviewVotes: unknown;
  products: unknown;
  eq: (a: unknown, b: unknown) => unknown;
  and: (...args: unknown[]) => unknown;
  desc: (col: unknown) => unknown;
  sql: unknown;
}

// レビュー取得ハンドラー
export function createUserReviewsGetHandler(deps: UserReviewsHandlerDeps) {
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
      const userId = searchParams.get('userId'); // 現在のユーザーID（投票状態確認用）

      const db = deps.getDb() as {
        select: (cols?: Record<string, unknown>) => {
          from: (table: unknown) => {
            leftJoin: (table: unknown, condition: unknown) => {
              where: (condition: unknown) => {
                orderBy: (order: unknown) => Promise<unknown[]>;
              };
            };
            where: (condition: unknown) => {
              orderBy: (order: unknown) => Promise<unknown[]>;
            };
          };
        };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userReviewsTable = deps.userReviews as any;

      // 承認済みレビューのみ取得
      const reviews = await db
        .select()
        .from(userReviewsTable)
        .where(
          deps.and(
            deps.eq(userReviewsTable.productId, productId),
            deps.eq(userReviewsTable.status, 'approved')
          )
        )
        .orderBy(deps.desc(userReviewsTable.createdAt)) as UserReview[];

      // ユーザーIDがあれば投票状態も取得
      let reviewsWithVotes: UserReviewWithVote[] = reviews;

      if (userId && reviews.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const votesTable = deps.userReviewVotes as any;
        const reviewIds = reviews.map(r => r.id);

        const votes = await db
          .select()
          .from(votesTable)
          .where(
            deps.and(
              deps.eq(votesTable.voterId, userId),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (deps.sql as any)`${votesTable.reviewId} IN (${reviewIds.join(',')})`
            )
          )
          .orderBy(deps.desc(votesTable.createdAt)) as { reviewId: number; voteType: string }[];

        const voteMap = new Map(votes.map(v => [v.reviewId, v.voteType as 'helpful' | 'not_helpful']));

        reviewsWithVotes = reviews.map(review => ({
          ...review,
          userVote: voteMap.get(review.id) || null,
        }));
      }

      return NextResponse.json({
        reviews: reviewsWithVotes,
        total: reviewsWithVotes.length,
      });
    } catch (error) {
      console.error('[UserReviews GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }
  };
}

// レビュー投稿ハンドラー
export function createUserReviewsPostHandler(deps: UserReviewsHandlerDeps) {
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
      const { userId, rating, title, content } = body;

      // バリデーション
      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
      }
      if (!content || content.length < 10) {
        return NextResponse.json({ error: 'Review content must be at least 10 characters' }, { status: 400 });
      }
      if (content.length > 5000) {
        return NextResponse.json({ error: 'Review content must be less than 5000 characters' }, { status: 400 });
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
      const userReviewsTable = deps.userReviews as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productsTable = deps.products as any;

      // 商品が存在するか確認
      const [product] = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(deps.eq(productsTable.id, productId))
        .limit(1) as { id: number; title: string }[];

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // 既存レビューがあるかチェック
      const [existingReview] = await db
        .select()
        .from(userReviewsTable)
        .where(
          deps.and(
            deps.eq(userReviewsTable.productId, productId),
            deps.eq(userReviewsTable.userId, userId)
          )
        )
        .limit(1) as UserReview[];

      if (existingReview) {
        return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 409 });
      }

      // AI審査を実行
      let moderationResult: ContentModerationResult | null = null;
      let status = 'pending';
      let moderationReason: string | null = null;
      let moderatedBy: string | null = null;

      try {
        moderationResult = await moderateUserReview({
          productTitle: product.title,
          reviewTitle: title,
          reviewContent: content,
          rating,
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
          // 'review' の場合は 'pending' のまま
        }
      } catch (moderationError) {
        console.error('[UserReviews] Moderation error:', moderationError);
        // 審査エラーの場合は pending のまま手動審査へ
      }

      // レビューを保存
      const [newReview] = await db
        .insert(userReviewsTable)
        .values({
          productId,
          userId,
          rating: rating.toString(),
          title: title || null,
          content,
          status,
          moderationReason,
          moderatedAt: status !== 'pending' ? new Date() : null,
          moderatedBy,
        })
        .returning() as UserReview[];

      return NextResponse.json({
        review: newReview,
        moderation: moderationResult ? {
          decision: moderationResult.decision,
          reason: moderationResult.reason,
        } : null,
      }, { status: 201 });
    } catch (error) {
      console.error('[UserReviews POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }
  };
}

// レビュー投票ハンドラー
export function createUserReviewVoteHandler(deps: UserReviewsHandlerDeps) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; reviewId: string }> }
  ): Promise<NextResponse> => {
    try {
      const { reviewId: reviewIdStr } = await params;
      const reviewId = parseInt(reviewIdStr, 10);

      if (isNaN(reviewId)) {
        return NextResponse.json({ error: 'Invalid review ID' }, { status: 400 });
      }

      const body = await req.json();
      const { userId, voteType } = body;

      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      if (!['helpful', 'not_helpful'].includes(voteType)) {
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
      const userReviewsTable = deps.userReviews as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const votesTable = deps.userReviewVotes as any;

      // レビューが存在するか確認
      const [review] = await db
        .select()
        .from(userReviewsTable)
        .where(deps.eq(userReviewsTable.id, reviewId))
        .limit(1) as UserReview[];

      if (!review) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }

      // 自分のレビューには投票できない
      if (review.userId === userId) {
        return NextResponse.json({ error: 'Cannot vote on your own review' }, { status: 403 });
      }

      // 既存の投票を確認
      const [existingVote] = await db
        .select()
        .from(votesTable)
        .where(
          deps.and(
            deps.eq(votesTable.reviewId, reviewId),
            deps.eq(votesTable.voterId, userId)
          )
        )
        .limit(1) as { reviewId: number; voterId: string; voteType: string }[];

      // 投票を更新または挿入（upsert）
      await db
        .insert(votesTable)
        .values({
          reviewId,
          voterId: userId,
          voteType,
        })
        .onConflictDoUpdate({
          target: [votesTable.reviewId, votesTable.voterId],
          set: { voteType },
        });

      // helpfulCount を更新
      if (voteType === 'helpful' && (!existingVote || existingVote.voteType !== 'helpful')) {
        // helpful が増える
        await db
          .update(userReviewsTable)
          .set({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            helpfulCount: (deps.sql as any)`COALESCE(${userReviewsTable.helpfulCount}, 0) + 1`,
          })
          .where(deps.eq(userReviewsTable.id, reviewId));
      } else if (voteType !== 'helpful' && existingVote?.voteType === 'helpful') {
        // helpful が減る
        await db
          .update(userReviewsTable)
          .set({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            helpfulCount: (deps.sql as any)`GREATEST(COALESCE(${userReviewsTable.helpfulCount}, 0) - 1, 0)`,
          })
          .where(deps.eq(userReviewsTable.id, reviewId));
      }

      return NextResponse.json({ success: true, voteType });
    } catch (error) {
      console.error('[UserReviewVote] Error:', error);
      return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
    }
  };
}
