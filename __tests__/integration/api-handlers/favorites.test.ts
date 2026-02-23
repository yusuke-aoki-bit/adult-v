/**
 * Public Favorite Lists API Handler 統合テスト
 * GET（一覧/個別取得）と POST（作成）ハンドラーの動作を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPublicFavoriteListsGetHandler,
  createPublicFavoriteListsPostHandler,
  type PublicFavoriteListsHandlerDeps,
} from '@adult-v/shared/api-handlers/public-favorite-lists';

// モックリストデータ
const mockLists = [
  {
    id: 1,
    userId: 'user-1',
    title: 'お気に入りリスト1',
    description: 'テスト用リスト',
    isPublic: true,
    viewCount: 100,
    likeCount: 10,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    userId: 'user-2',
    title: 'お気に入りリスト2',
    description: null,
    isPublic: true,
    viewCount: 50,
    likeCount: 5,
    createdAt: new Date('2024-01-10'),
  },
];

const mockListItems = [
  {
    listId: 1,
    productId: 100,
    displayOrder: 1,
    note: 'おすすめ',
    addedAt: new Date('2024-01-05'),
    productTitle: 'テスト作品A',
    productThumbnail: 'https://example.com/a.jpg',
  },
];

// チェーン可能なDB操作モックを作成するヘルパー
function createDbMock() {
  const db: Record<string, any> = {};

  // select chain
  const selectChain: Record<string, any> = {};
  selectChain.from = vi.fn().mockReturnValue(selectChain);
  selectChain.leftJoin = vi.fn().mockReturnValue(selectChain);
  selectChain.where = vi.fn().mockReturnValue(selectChain);
  selectChain.orderBy = vi.fn().mockReturnValue(selectChain);
  selectChain.limit = vi.fn().mockReturnValue(selectChain);
  selectChain.offset = vi.fn().mockResolvedValue(mockLists);

  db.select = vi.fn().mockReturnValue(selectChain);

  // insert chain
  const insertChain: Record<string, any> = {};
  insertChain.values = vi.fn().mockReturnValue(insertChain);
  insertChain.returning = vi
    .fn()
    .mockResolvedValue([{ id: 3, title: '新しいリスト', userId: 'user-1', isPublic: true }]);
  insertChain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  db.insert = vi.fn().mockReturnValue(insertChain);

  // update chain
  const updateChain: Record<string, any> = {};
  updateChain.set = vi.fn().mockReturnValue(updateChain);
  updateChain.where = vi.fn().mockResolvedValue(undefined);
  db.update = vi.fn().mockReturnValue(updateChain);

  // execute for raw SQL queries
  db.execute = vi.fn().mockResolvedValue({ rows: [] });

  return { db, selectChain, insertChain };
}

// テーブルオブジェクトのモック
const mockTables = {
  publicFavoriteLists: {
    id: 'publicFavoriteLists.id',
    userId: 'publicFavoriteLists.userId',
    title: 'publicFavoriteLists.title',
    description: 'publicFavoriteLists.description',
    isPublic: 'publicFavoriteLists.isPublic',
    viewCount: 'publicFavoriteLists.viewCount',
    likeCount: 'publicFavoriteLists.likeCount',
    createdAt: 'publicFavoriteLists.createdAt',
    updatedAt: 'publicFavoriteLists.updatedAt',
  },
  publicFavoriteListItems: {
    listId: 'publicFavoriteListItems.listId',
    productId: 'publicFavoriteListItems.productId',
    displayOrder: 'publicFavoriteListItems.displayOrder',
    note: 'publicFavoriteListItems.note',
    addedAt: 'publicFavoriteListItems.addedAt',
  },
  publicListLikes: {
    listId: 'publicListLikes.listId',
    userId: 'publicListLikes.userId',
  },
  products: {
    id: 'products.id',
    title: 'products.title',
    thumbnailUrl: 'products.thumbnailUrl',
  },
};

describe('Public Favorite Lists GET Handler Integration', () => {
  let dbMock: ReturnType<typeof createDbMock>;
  let deps: PublicFavoriteListsHandlerDeps;

  beforeEach(() => {
    dbMock = createDbMock();
    deps = {
      getDb: () => dbMock.db,
      publicFavoriteLists: mockTables.publicFavoriteLists,
      publicFavoriteListItems: mockTables.publicFavoriteListItems,
      publicListLikes: mockTables.publicListLikes,
      products: mockTables.products,
      eq: vi.fn().mockReturnValue('eq_condition'),
      and: vi.fn().mockReturnValue('and_condition'),
      desc: vi.fn().mockReturnValue('desc_order'),
      asc: vi.fn().mockReturnValue('asc_order'),
      sql: Object.assign(vi.fn().mockReturnValue('sql_expr'), {
        join: vi.fn().mockReturnValue('sql_join'),
      }),
    };
  });

  it('should create a handler function', () => {
    const handler = createPublicFavoriteListsGetHandler(deps);
    expect(typeof handler).toBe('function');
  });

  it('should return public lists by default', async () => {
    const handler = createPublicFavoriteListsGetHandler(deps);
    const request = new Request('http://localhost/api/public-lists');

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toBeDefined();
    expect(Array.isArray(data.lists)).toBe(true);
  });

  it('should return 404 for individual list that does not exist', async () => {
    // select().from().where().limit() で空配列を返す
    dbMock.selectChain.limit = vi.fn().mockResolvedValue([]);

    const handler = createPublicFavoriteListsGetHandler(deps);
    const request = new Request('http://localhost/api/public-lists/999');

    const response = await handler(request as any, { params: { id: '999' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('List not found');
  });

  it('should return 403 for private list accessed by non-owner', async () => {
    // 非公開リストを返す
    const privateList = { ...mockLists[0], isPublic: false, userId: 'owner-user' };
    dbMock.selectChain.limit = vi.fn().mockResolvedValue([privateList]);

    const handler = createPublicFavoriteListsGetHandler(deps);
    const request = new Request('http://localhost/api/public-lists/1?userId=other-user');

    const response = await handler(request as any, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied');
  });

  it('should return individual list with items when accessible', async () => {
    // 公開リストとアイテムを順番に返す
    let selectCallCount = 0;
    dbMock.db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockResolvedValue(selectCallCount === 2 ? mockListItems : []);
      chain.limit = vi.fn().mockResolvedValue(
        selectCallCount === 1
          ? [mockLists[0]] // list
          : selectCallCount === 3
            ? [] // like check
            : [],
      );
      return chain;
    });

    const handler = createPublicFavoriteListsGetHandler(deps);
    const request = new Request('http://localhost/api/public-lists/1');

    const response = await handler(request as any, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list).toBeDefined();
    expect(data.items).toBeDefined();
  });

  it('should handle database errors gracefully', async () => {
    dbMock.db.select = vi.fn().mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const handler = createPublicFavoriteListsGetHandler(deps);
    const request = new Request('http://localhost/api/public-lists');

    const response = await handler(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

describe('Public Favorite Lists POST Handler Integration', () => {
  let dbMock: ReturnType<typeof createDbMock>;
  let deps: PublicFavoriteListsHandlerDeps;

  beforeEach(() => {
    dbMock = createDbMock();
    deps = {
      getDb: () => dbMock.db,
      publicFavoriteLists: mockTables.publicFavoriteLists,
      publicFavoriteListItems: mockTables.publicFavoriteListItems,
      publicListLikes: mockTables.publicListLikes,
      products: mockTables.products,
      eq: vi.fn(),
      and: vi.fn(),
      desc: vi.fn(),
      asc: vi.fn(),
      sql: vi.fn(),
    };
  });

  it('should return 401 when userId is missing', async () => {
    const handler = createPublicFavoriteListsPostHandler(deps);
    const request = new Request('http://localhost/api/public-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'テストリスト' }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('User ID required');
  });

  it('should return 400 when title is too short', async () => {
    const handler = createPublicFavoriteListsPostHandler(deps);
    const request = new Request('http://localhost/api/public-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', title: 'a' }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('at least 2 characters');
  });

  it('should create a list successfully with valid data', async () => {
    const handler = createPublicFavoriteListsPostHandler(deps);
    const request = new Request('http://localhost/api/public-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        title: 'テストリスト',
        description: '説明文',
        isPublic: true,
      }),
    });

    const response = await handler(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.list).toBeDefined();
    expect(dbMock.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: 'テストリスト',
        description: '説明文',
        isPublic: true,
      }),
    );
  });

  it('should handle database errors on create', async () => {
    dbMock.insertChain.returning.mockRejectedValue(new Error('Insert failed'));

    const handler = createPublicFavoriteListsPostHandler(deps);
    const request = new Request('http://localhost/api/public-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        title: 'テストリスト',
      }),
    });

    const response = await handler(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
