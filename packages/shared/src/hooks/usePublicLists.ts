'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PublicList {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  itemCount?: number;
  userLiked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PublicListItem {
  listId: number;
  productId: number;
  displayOrder: number;
  note: string | null;
  addedAt: string;
  product?: {
    id: number;
    title: string;
    thumbnailUrl: string | null;
  };
}

export interface CreateListParams {
  title: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateListParams {
  title?: string;
  description?: string;
  isPublic?: boolean;
}

interface UsePublicListsOptions {
  userId?: string | null;
  autoFetch?: boolean;
}

export function usePublicLists(options: UsePublicListsOptions = {}) {
  const { userId, autoFetch = true } = options;
  const [lists, setLists] = useState<PublicList[]>([]);
  const [myLists, setMyLists] = useState<PublicList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 公開リスト一覧を取得
  const fetchPublicLists = useCallback(async (page = 1, limit = 20) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (userId) params.set('userId', userId);

      const res = await fetch(`/api/public-lists?${params}`);
      if (!res.ok) throw new Error('Failed to fetch lists');

      const data = await res.json();
      setLists(data.lists || []);
      return data.lists;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 自分のリスト一覧を取得
  const fetchMyLists = useCallback(async () => {
    if (!userId) return [];

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        myLists: 'true',
        userId,
      });

      const res = await fetch(`/api/public-lists?${params}`);
      if (!res.ok) throw new Error('Failed to fetch my lists');

      const data = await res.json();
      setMyLists(data.lists || []);
      return data.lists;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 個別リスト取得
  const fetchList = useCallback(async (listId: number) => {
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);

      const res = await fetch(`/api/public-lists/${listId}?${params}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 403) throw new Error('Access denied');
        throw new Error('Failed to fetch list');
      }

      const data = await res.json();
      return data as { list: PublicList; items: PublicListItem[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [userId]);

  // リスト作成
  const createList = useCallback(async (params: CreateListParams) => {
    if (!userId) {
      setError('Login required');
      return null;
    }

    try {
      const res = await fetch('/api/public-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...params }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create list');
      }

      const data = await res.json();
      setMyLists(prev => [data.list, ...prev]);
      return data.list as PublicList;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [userId]);

  // リスト更新
  const updateList = useCallback(async (listId: number, params: UpdateListParams) => {
    if (!userId) {
      setError('Login required');
      return null;
    }

    try {
      const res = await fetch(`/api/public-lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...params }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update list');
      }

      const data = await res.json();
      setMyLists(prev => prev.map(l => l.id === listId ? data.list : l));
      return data.list as PublicList;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [userId]);

  // リスト削除
  const deleteList = useCallback(async (listId: number) => {
    if (!userId) {
      setError('Login required');
      return false;
    }

    try {
      const params = new URLSearchParams({ userId });
      const res = await fetch(`/api/public-lists/${listId}?${params}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete list');
      }

      setMyLists(prev => prev.filter(l => l.id !== listId));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    }
  }, [userId]);

  // アイテム追加
  const addItem = useCallback(async (listId: number, productId: number, note?: string) => {
    if (!userId) {
      setError('Login required');
      return false;
    }

    try {
      const res = await fetch(`/api/public-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId, action: 'add', note }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add item');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    }
  }, [userId]);

  // アイテム削除
  const removeItem = useCallback(async (listId: number, productId: number) => {
    if (!userId) {
      setError('Login required');
      return false;
    }

    try {
      const res = await fetch(`/api/public-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId, action: 'remove' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove item');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    }
  }, [userId]);

  // いいね
  const toggleLike = useCallback(async (listId: number, currentlyLiked: boolean) => {
    if (!userId) {
      setError('Login required');
      return false;
    }

    try {
      const res = await fetch(`/api/public-lists/${listId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: currentlyLiked ? 'unlike' : 'like' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle like');
      }

      // リストを更新
      setLists(prev => prev.map(l => {
        if (l.id === listId) {
          return {
            ...l,
            userLiked: !currentlyLiked,
            likeCount: l.likeCount + (currentlyLiked ? -1 : 1),
          };
        }
        return l;
      }));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    }
  }, [userId]);

  // 初期ロード
  useEffect(() => {
    if (autoFetch) {
      fetchPublicLists();
      if (userId) {
        fetchMyLists();
      }
    }
  }, [autoFetch, userId, fetchPublicLists, fetchMyLists]);

  return {
    // State
    lists,
    myLists,
    isLoading,
    error,

    // Actions
    fetchPublicLists,
    fetchMyLists,
    fetchList,
    createList,
    updateList,
    deleteList,
    addItem,
    removeItem,
    toggleLike,

    // Clear error
    clearError: () => setError(null),
  };
}
