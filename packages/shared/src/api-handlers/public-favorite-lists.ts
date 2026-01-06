import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

// Types for dependency injection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PublicFavoriteListsHandlerDeps {
  getDb: () => unknown;
  publicFavoriteLists: unknown;
  publicFavoriteListItems: unknown;
  publicListLikes: unknown;
  products: unknown;
  eq: (column: any, value: any) => unknown;
  and: (...conditions: any[]) => unknown;
  desc: (column: any) => unknown;
  asc: (column: any) => unknown;
  sql: unknown;
  count?: unknown;
}

export interface PublicFavoriteList {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  itemCount?: number;
  userLiked?: boolean;
}

export interface PublicFavoriteListItem {
  listId: number;
  productId: number;
  displayOrder: number;
  note: string | null;
  addedAt: Date;
  product?: {
    id: number;
    title: string;
    thumbnailUrl: string | null;
  };
}

// GET handler - リスト一覧取得 or 個別リスト取得
export function createPublicFavoriteListsGetHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest, context?: { params?: { id?: string } }) => {
    const { getDb, publicFavoriteLists, publicFavoriteListItems, publicListLikes, products, eq, and, desc, sql } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const { searchParams } = new URL(request['url']);
      const listId = context?.params?.id;
      const userId = searchParams.get('userId');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;

      // 個別リスト取得
      if (listId) {
        const list = await (db['select'] as CallableFunction)({
          id: (publicFavoriteLists as Record<string, unknown>)['id'],
          userId: (publicFavoriteLists as Record<string, unknown>)['userId'],
          title: (publicFavoriteLists as Record<string, unknown>)['title'],
          description: (publicFavoriteLists as Record<string, unknown>)['description'],
          isPublic: (publicFavoriteLists as Record<string, unknown>)['isPublic'],
          viewCount: (publicFavoriteLists as Record<string, unknown>)['viewCount'],
          likeCount: (publicFavoriteLists as Record<string, unknown>)['likeCount'],
          createdAt: (publicFavoriteLists as Record<string, unknown>)['createdAt'],
          updatedAt: (publicFavoriteLists as Record<string, unknown>)['updatedAt'],
        })
          .from(publicFavoriteLists)
          .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], parseInt(listId, 10)))
          .limit(1);

        if (list.length === 0) {
          return NextResponse.json({ error: 'List not found' }, { status: 404 });
        }

        const listData = list[0] as PublicFavoriteList;

        // 非公開リストは所有者のみアクセス可能
        if (!listData.isPublic && listData.userId !== userId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // アイテム取得
        const items = await (db['select'] as CallableFunction)({
          listId: (publicFavoriteListItems as Record<string, unknown>)['listId'],
          productId: (publicFavoriteListItems as Record<string, unknown>)['productId'],
          displayOrder: (publicFavoriteListItems as Record<string, unknown>)['displayOrder'],
          note: (publicFavoriteListItems as Record<string, unknown>)['note'],
          addedAt: (publicFavoriteListItems as Record<string, unknown>)['addedAt'],
          productTitle: (products as Record<string, unknown>)['title'],
          productThumbnail: (products as Record<string, unknown>)['thumbnailUrl'],
        })
          .from(publicFavoriteListItems)
          .leftJoin(products, eq((publicFavoriteListItems as Record<string, unknown>)['productId'], (products as Record<string, unknown>)['id']))
          .where(eq((publicFavoriteListItems as Record<string, unknown>)['listId'], parseInt(listId, 10)))
          .orderBy((publicFavoriteListItems as Record<string, unknown>)['displayOrder']);

        // ユーザーがいいね済みかチェック
        let userLiked = false;
        if (userId) {
          const likeCheck = await (db['select'] as CallableFunction)()
            .from(publicListLikes)
            .where(and(
              eq((publicListLikes as Record<string, unknown>)['listId'], parseInt(listId, 10)),
              eq((publicListLikes as Record<string, unknown>)['userId'], userId)
            ))
            .limit(1);
          userLiked = likeCheck.length > 0;
        }

        // 閲覧数をインクリメント（所有者以外）
        if (listData.userId !== userId) {
          await (db['update'] as CallableFunction)(publicFavoriteLists)
            .set({ viewCount: (sql as CallableFunction)`${(publicFavoriteLists as Record<string, unknown>)['viewCount']} + 1` })
            .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], parseInt(listId, 10)));
        }

        return NextResponse.json({
          list: {
            ...listData,
            itemCount: items.length,
            userLiked,
          },
          items: items.map((item: Record<string, unknown>) => ({
            listId: item['listId'],
            productId: item['productId'],
            displayOrder: item['displayOrder'],
            note: item['note'],
            addedAt: item['addedAt'],
            product: {
              id: item['productId'],
              title: item['productTitle'],
              thumbnailUrl: item['productThumbnail'],
            },
          })),
        });
      }

      // リスト一覧取得
      const myLists = searchParams.get('myLists') === 'true';

      let whereCondition;
      if (myLists && userId) {
        // 自分のリスト（公開・非公開両方）
        whereCondition = eq((publicFavoriteLists as Record<string, unknown>)['userId'], userId);
      } else {
        // 公開リストのみ
        whereCondition = eq((publicFavoriteLists as Record<string, unknown>)['isPublic'], true);
      }

      const lists = await (db['select'] as CallableFunction)({
        id: (publicFavoriteLists as Record<string, unknown>)['id'],
        userId: (publicFavoriteLists as Record<string, unknown>)['userId'],
        title: (publicFavoriteLists as Record<string, unknown>)['title'],
        description: (publicFavoriteLists as Record<string, unknown>)['description'],
        isPublic: (publicFavoriteLists as Record<string, unknown>)['isPublic'],
        viewCount: (publicFavoriteLists as Record<string, unknown>)['viewCount'],
        likeCount: (publicFavoriteLists as Record<string, unknown>)['likeCount'],
        createdAt: (publicFavoriteLists as Record<string, unknown>)['createdAt'],
      })
        .from(publicFavoriteLists)
        .where(whereCondition)
        .orderBy(desc((publicFavoriteLists as Record<string, unknown>)['likeCount']))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ lists });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch lists', 500, {
        endpoint: '/api/public-lists',
      });
    }
  };
}

// POST handler - リスト作成
export function createPublicFavoriteListsPostHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest) => {
    const { getDb, publicFavoriteLists } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const body = await request.json();
      const { userId, title, description, isPublic = true } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      if (!title || title.trim().length < 2) {
        return NextResponse.json({ error: 'Title must be at least 2 characters' }, { status: 400 });
      }

      const result = await (db['insert'] as CallableFunction)(publicFavoriteLists)
        .values({
          userId,
          title: title.trim(),
          description: description?.trim() || null,
          isPublic,
        })
        .returning();

      return NextResponse.json({ list: result[0] }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to create list', 500, {
        endpoint: '/api/public-lists',
      });
    }
  };
}

// PUT handler - リスト更新
export function createPublicFavoriteListsPutHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, publicFavoriteLists, eq, and } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const listId = parseInt(context.params['id'], 10);
      const body = await request.json();
      const { userId, title, description, isPublic } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      // 所有者確認
      const existing = await (db['select'] as CallableFunction)()
        .from(publicFavoriteLists)
        .where(and(
          eq((publicFavoriteLists as Record<string, unknown>)['id'], listId),
          eq((publicFavoriteLists as Record<string, unknown>)['userId'], userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return NextResponse.json({ error: 'List not found or access denied' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updateData['title'] = title.trim();
      if (description !== undefined) updateData['description'] = description?.trim() || null;
      if (isPublic !== undefined) updateData['isPublic'] = isPublic;

      const result = await (db['update'] as CallableFunction)(publicFavoriteLists)
        .set(updateData)
        .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], listId))
        .returning();

      return NextResponse.json({ list: result[0] });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to update list', 500, {
        endpoint: '/api/public-lists',
      });
    }
  };
}

// DELETE handler - リスト削除
export function createPublicFavoriteListsDeleteHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, publicFavoriteLists, eq, and } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const listId = parseInt(context.params['id'], 10);
      const { searchParams } = new URL(request['url']);
      const userId = searchParams.get('userId');

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      // 所有者確認して削除
      const result = await (db['delete'] as CallableFunction)(publicFavoriteLists)
        .where(and(
          eq((publicFavoriteLists as Record<string, unknown>)['id'], listId),
          eq((publicFavoriteLists as Record<string, unknown>)['userId'], userId)
        ))
        .returning();

      if (result.length === 0) {
        return NextResponse.json({ error: 'List not found or access denied' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to delete list', 500, {
        endpoint: '/api/public-lists',
      });
    }
  };
}

// アイテム追加/削除ハンドラー
export function createPublicFavoriteListItemsHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, publicFavoriteLists, publicFavoriteListItems, eq, and } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const listId = parseInt(context.params['id'], 10);
      const body = await request.json();
      const { userId, productId, action, note } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      // 所有者確認
      const list = await (db['select'] as CallableFunction)()
        .from(publicFavoriteLists)
        .where(and(
          eq((publicFavoriteLists as Record<string, unknown>)['id'], listId),
          eq((publicFavoriteLists as Record<string, unknown>)['userId'], userId)
        ))
        .limit(1);

      if (list.length === 0) {
        return NextResponse.json({ error: 'List not found or access denied' }, { status: 404 });
      }

      if (action === 'add') {
        // アイテム追加
        await (db['insert'] as CallableFunction)(publicFavoriteListItems)
          .values({
            listId,
            productId,
            note: note?.trim() || null,
          })
          .onConflictDoNothing();

        return NextResponse.json({ success: true, action: 'added' });
      } else if (action === 'remove') {
        // アイテム削除
        await (db['delete'] as CallableFunction)(publicFavoriteListItems)
          .where(and(
            eq((publicFavoriteListItems as Record<string, unknown>)['listId'], listId),
            eq((publicFavoriteListItems as Record<string, unknown>)['productId'], productId)
          ));

        return NextResponse.json({ success: true, action: 'removed' });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to modify list items', 500, {
        endpoint: '/api/public-lists/items',
      });
    }
  };
}

// いいねハンドラー
export function createPublicFavoriteListLikeHandler(deps: PublicFavoriteListsHandlerDeps) {
  return async (request: NextRequest, context: { params: { id: string } }) => {
    const { getDb, publicFavoriteLists, publicListLikes, eq, and, sql } = deps;

    try {
      const db = getDb() as Record<string, unknown>;
      const listId = parseInt(context.params['id'], 10);
      const body = await request.json();
      const { userId, action } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 401 });
      }

      // リストが存在し、公開されているか確認
      const list = await (db['select'] as CallableFunction)()
        .from(publicFavoriteLists)
        .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], listId))
        .limit(1);

      if (list.length === 0) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }

      const listData = list[0] as PublicFavoriteList;
      if (!listData.isPublic) {
        return NextResponse.json({ error: 'Cannot like private list' }, { status: 403 });
      }

      // 自分のリストにはいいねできない
      if (listData.userId === userId) {
        return NextResponse.json({ error: 'Cannot like own list' }, { status: 400 });
      }

      if (action === 'like') {
        // いいね追加
        await (db['insert'] as CallableFunction)(publicListLikes)
          .values({ listId, userId })
          .onConflictDoNothing();

        // カウント更新
        await (db['update'] as CallableFunction)(publicFavoriteLists)
          .set({ likeCount: (sql as CallableFunction)`${(publicFavoriteLists as Record<string, unknown>)['likeCount']} + 1` })
          .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], listId));

        return NextResponse.json({ success: true, action: 'liked' });
      } else if (action === 'unlike') {
        // いいね削除
        const deleted = await (db['delete'] as CallableFunction)(publicListLikes)
          .where(and(
            eq((publicListLikes as Record<string, unknown>)['listId'], listId),
            eq((publicListLikes as Record<string, unknown>)['userId'], userId)
          ))
          .returning();

        if (deleted.length > 0) {
          // カウント更新
          await (db['update'] as CallableFunction)(publicFavoriteLists)
            .set({ likeCount: (sql as CallableFunction)`GREATEST(${(publicFavoriteLists as Record<string, unknown>)['likeCount']} - 1, 0)` })
            .where(eq((publicFavoriteLists as Record<string, unknown>)['id'], listId));
        }

        return NextResponse.json({ success: true, action: 'unliked' });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to toggle like', 500, {
        endpoint: '/api/public-lists/like',
      });
    }
  };
}
