/**
 * User Content API Handlers 統合テスト
 * user-reviews と user-corrections ハンドラーの動作を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUserReviewsGetHandler,
  createUserReviewsPostHandler,
  type UserReviewsHandlerDeps,
} from '@adult-v/shared/api-handlers/user-reviews';
import {
  createUserCorrectionsPostHandler,
  type UserCorrectionsHandlerDeps,
} from '@adult-v/shared/api-handlers/user-corrections';

// LLM moderationモジュールをモック
vi.mock('@adult-v/shared/lib/llm-service', () => ({
  moderateUserReview: vi.fn().mockResolvedValue({
    decision: 'approve',
    reason: 'Content is appropriate',
  }),
}));

// api-loggerモジュールをモック
vi.mock('@adult-v/shared/lib/api-logger', () => ({
  createApiErrorResponse: vi.fn().mockImplementation((_error: unknown, message: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: message }, { status });
  }),
  logApiWarning: vi.fn(),
}));

// =========================================================
// User Reviews
// =========================================================

function createReviewsDbMock() {
  const db: Record<string, any> = {};
  const selectChain: Record<string, any> = {};
  selectChain.from = vi.fn().mockReturnValue(selectChain);
  selectChain.leftJoin = vi.fn().mockReturnValue(selectChain);
  selectChain.where = vi.fn().mockReturnValue(selectChain);
  selectChain.orderBy = vi.fn().mockResolvedValue([]);
  selectChain.limit = vi.fn().mockResolvedValue([]);
  db.select = vi.fn().mockReturnValue(selectChain);

  const insertChain: Record<string, any> = {};
  insertChain.values = vi.fn().mockReturnValue(insertChain);
  insertChain.returning = vi.fn().mockResolvedValue([
    {
      id: 1,
      productId: 100,
      userId: 'user-1',
      rating: '4',
      title: 'テストレビュー',
      content: 'これはテストレビューの内容です。十分な長さがあります。',
      status: 'approved',
      helpfulCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  db.insert = vi.fn().mockReturnValue(insertChain);

  return { db, selectChain, insertChain };
}

const mockUserReviewsTable = {
  id: 'userReviews.id',
  productId: 'userReviews.productId',
  userId: 'userReviews.userId',
  rating: 'userReviews.rating',
  title: 'userReviews.title',
  content: 'userReviews.content',
  helpfulCount: 'userReviews.helpfulCount',
  status: 'userReviews.status',
  createdAt: 'userReviews.createdAt',
};

const mockUserReviewVotesTable = {
  reviewId: 'userReviewVotes.reviewId',
  voterId: 'userReviewVotes.voterId',
  voteType: 'userReviewVotes.voteType',
  createdAt: 'userReviewVotes.createdAt',
};

const mockProductsTable = {
  id: 'products.id',
  title: 'products.title',
};

describe('User Reviews GET Handler Integration', () => {
  let dbMock: ReturnType<typeof createReviewsDbMock>;
  let deps: UserReviewsHandlerDeps;

  beforeEach(() => {
    dbMock = createReviewsDbMock();
    deps = {
      getDb: () => dbMock.db,
      userReviews: mockUserReviewsTable,
      userReviewVotes: mockUserReviewVotesTable,
      products: mockProductsTable,
      eq: vi.fn().mockReturnValue('eq_condition'),
      and: vi.fn().mockReturnValue('and_condition'),
      desc: vi.fn().mockReturnValue('desc_order'),
      sql: Object.assign(vi.fn().mockReturnValue('sql_expr'), {
        join: vi.fn().mockReturnValue('sql_join'),
      }),
    };
  });

  it('should create a handler function', () => {
    const handler = createUserReviewsGetHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return 400 for invalid product ID', async () => {
    const handler = createUserReviewsGetHandler(deps);
    const request = new Request('http://localhost/api/products/abc/reviews');

    const response = await handler(request as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid product ID');
  });

  it('should return reviews for a valid product ID', async () => {
    const mockReviews = [
      {
        id: 1,
        productId: 100,
        userId: 'user-1',
        rating: '4',
        content: 'Great!',
        status: 'approved',
        helpfulCount: 5,
        createdAt: new Date(),
      },
    ];
    dbMock.selectChain.orderBy = vi.fn().mockResolvedValue(mockReviews);

    const handler = createUserReviewsGetHandler(deps);
    const request = new Request('http://localhost/api/products/100/reviews');

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviews).toBeDefined();
    expect(data.total).toBe(1);
  });

  it('should handle database errors gracefully', async () => {
    dbMock.selectChain.orderBy = vi.fn().mockRejectedValue(new Error('DB Error'));

    const handler = createUserReviewsGetHandler(deps);
    const request = new Request('http://localhost/api/products/100/reviews');

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });

    expect(response.status).toBe(500);
  });
});

describe('User Reviews POST Handler Integration', () => {
  let dbMock: ReturnType<typeof createReviewsDbMock>;
  let deps: UserReviewsHandlerDeps;

  beforeEach(() => {
    dbMock = createReviewsDbMock();

    // select chain が product検索と既存レビュー検索で異なる結果を返す
    let selectCallCount = 0;
    dbMock.db.select = vi.fn().mockImplementation((cols?: Record<string, unknown>) => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) {
          // 商品検索: 存在する
          return Promise.resolve([{ id: 100, title: 'テスト作品' }]);
        }
        // 既存レビュー検索: 存在しない
        return Promise.resolve([]);
      });
      return chain;
    });

    deps = {
      getDb: () => dbMock.db,
      userReviews: mockUserReviewsTable,
      userReviewVotes: mockUserReviewVotesTable,
      products: mockProductsTable,
      eq: vi.fn().mockReturnValue('eq_condition'),
      and: vi.fn().mockReturnValue('and_condition'),
      desc: vi.fn().mockReturnValue('desc_order'),
      sql: vi.fn().mockReturnValue('sql_expr'),
    };
  });

  it('should return 400 for invalid product ID', async () => {
    const handler = createUserReviewsPostHandler(deps);
    const request = new Request('http://localhost/api/products/abc/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', rating: 4, content: 'Good product for testing purposes' }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid product ID');
  });

  it('should return 400 when userId is missing', async () => {
    const handler = createUserReviewsPostHandler(deps);
    const request = new Request('http://localhost/api/products/100/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4, content: 'Good product for testing purposes' }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('User ID is required');
  });

  it('should return 400 when rating is out of range', async () => {
    const handler = createUserReviewsPostHandler(deps);
    const request = new Request('http://localhost/api/products/100/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', rating: 6, content: 'Good product for testing purposes' }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('Rating');
  });

  it('should return 400 when content is too short', async () => {
    const handler = createUserReviewsPostHandler(deps);
    const request = new Request('http://localhost/api/products/100/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', rating: 4, content: 'Short' }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('at least 10 characters');
  });

  it('should return 400 when content is too long', async () => {
    const handler = createUserReviewsPostHandler(deps);
    const longContent = 'a'.repeat(5001);
    const request = new Request('http://localhost/api/products/100/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', rating: 4, content: longContent }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: '100' }) });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('5000 characters');
  });

  it('should return 404 when product does not exist', async () => {
    // 商品が存在しないケース
    dbMock.db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]); // 商品なし
      return chain;
    });

    const handler = createUserReviewsPostHandler(deps);
    const request = new Request('http://localhost/api/products/999/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', rating: 4, content: 'Good product for testing purposes' }),
    });

    const response = await handler(request as any, { params: Promise.resolve({ id: '999' }) });

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('Product not found');
  });
});

// =========================================================
// User Corrections
// =========================================================

function createCorrectionsDbMock() {
  const db: Record<string, any> = {};

  const insertChain: Record<string, any> = {};
  insertChain.values = vi.fn().mockReturnValue(insertChain);
  insertChain.returning = vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 'user-1',
      targetType: 'product',
      targetId: 100,
      fieldName: 'title',
      suggestedValue: '正しいタイトル',
      status: 'pending',
      createdAt: new Date(),
    },
  ]);
  insertChain.onConflictDoUpdate = vi.fn().mockReturnValue(insertChain);

  db.insert = vi.fn().mockReturnValue(insertChain);

  // update chain for contribution stats
  const updateChain: Record<string, any> = {};
  updateChain.set = vi.fn().mockReturnValue(updateChain);
  updateChain.where = vi.fn().mockResolvedValue(undefined);
  db.update = vi.fn().mockReturnValue(updateChain);

  return { db, insertChain };
}

const mockUserCorrectionsTable = {
  id: 'userCorrections.id',
  targetType: 'userCorrections.targetType',
  targetId: 'userCorrections.targetId',
  userId: 'userCorrections.userId',
  fieldName: 'userCorrections.fieldName',
  currentValue: 'userCorrections.currentValue',
  suggestedValue: 'userCorrections.suggestedValue',
  reason: 'userCorrections.reason',
  status: 'userCorrections.status',
  reviewedBy: 'userCorrections.reviewedBy',
  reviewedAt: 'userCorrections.reviewedAt',
  createdAt: 'userCorrections.createdAt',
};

const mockContributionStatsTable = {
  userId: 'userContributionStats.userId',
  correctionCount: 'userContributionStats.correctionCount',
  correctionApprovedCount: 'userContributionStats.correctionApprovedCount',
  contributionScore: 'userContributionStats.contributionScore',
};

describe('User Corrections POST Handler Integration', () => {
  let dbMock: ReturnType<typeof createCorrectionsDbMock>;
  let deps: UserCorrectionsHandlerDeps;

  beforeEach(() => {
    dbMock = createCorrectionsDbMock();
    deps = {
      getDb: () => dbMock.db,
      userCorrections: mockUserCorrectionsTable,
      userContributionStats: mockContributionStatsTable,
      eq: vi.fn().mockReturnValue('eq_condition'),
      and: vi.fn().mockReturnValue('and_condition'),
      desc: vi.fn().mockReturnValue('desc_order'),
      sql: Object.assign(vi.fn().mockReturnValue('sql_expr'), {
        join: vi.fn().mockReturnValue('sql_join'),
      }),
    };
  });

  it('should create a handler function', () => {
    const handler = createUserCorrectionsPostHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return 401 when userId is missing', async () => {
    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'product', targetId: 100, fieldName: 'title', suggestedValue: '新しい値' }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('User ID required');
  });

  it('should return 400 for invalid target type', async () => {
    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        targetType: 'invalid',
        targetId: 100,
        fieldName: 'title',
        suggestedValue: '新しい値',
      }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid target type');
  });

  it('should return 400 when fieldName is missing', async () => {
    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', targetType: 'product', targetId: 100, suggestedValue: '新しい値' }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Field name required');
  });

  it('should return 400 when suggestedValue is empty', async () => {
    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        targetType: 'product',
        targetId: 100,
        fieldName: 'title',
        suggestedValue: '  ',
      }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Suggested value required');
  });

  it('should create a correction successfully', async () => {
    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        targetType: 'product',
        targetId: 100,
        fieldName: 'title',
        currentValue: '古いタイトル',
        suggestedValue: '正しいタイトル',
        reason: '誤字修正',
      }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.correction).toBeDefined();
    // DB insertが呼ばれたことを確認
    expect(dbMock.db.insert).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    dbMock.insertChain.returning.mockRejectedValue(new Error('DB Error'));

    const handler = createUserCorrectionsPostHandler(deps);
    const request = new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        targetType: 'product',
        targetId: 100,
        fieldName: 'title',
        suggestedValue: '新しい値',
      }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
