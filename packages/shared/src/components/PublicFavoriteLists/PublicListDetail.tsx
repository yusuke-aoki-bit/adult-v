'use client';

import { useState, useEffect } from 'react';
import { Heart, Eye, ArrowLeft, Globe, Lock, Loader2, Share2, Trash2 } from 'lucide-react';

interface ListItem {
  listId: number;
  productId: number;
  displayOrder: number;
  note: string | null;
  addedAt: string;
  product: {
    id: number;
    title: string;
    thumbnailUrl: string | null;
  };
}

interface ListDetail {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  itemCount: number;
  userLiked: boolean;
}

export interface PublicListDetailProps {
  listId: number;
  userId: string | null;
  onBack: () => void;
  onProductClick: (productId: number) => void;
  onRemoveItem?: (productId: number) => void;
  translations: {
    loading: string;
    error: string;
    notFound: string;
    back: string;
    views: string;
    likes: string;
    items: string;
    private: string;
    public: string;
    share: string;
    copied: string;
    emptyList: string;
    removeItem: string;
  };
}

export function PublicListDetail({
  listId,
  userId,
  onBack,
  onProductClick,
  onRemoveItem,
  translations: t,
}: PublicListDetailProps) {
  const [list, setList] = useState<ListDetail | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    fetchList();
  }, [listId, userId]);

  const fetchList = async () => {
    try {
      const url = userId ? `/api/favorite-lists/${listId}?userId=${userId}` : `/api/favorite-lists/${listId}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response['status'] === 404) {
          setError(t.notFound);
        } else {
          setError(t.error);
        }
        return;
      }

      const data = await response.json();
      setList(data.list);
      setItems(data.items);
    } catch {
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!userId || !list || list['userId'] === userId || isLiking) return;

    setIsLiking(true);
    try {
      const response = await fetch(`/api/favorite-lists/${listId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: list.userLiked ? 'unlike' : 'like',
        }),
      });

      if (response.ok) {
        setList((prev) =>
          prev
            ? {
                ...prev,
                userLiked: !prev.userLiked,
                likeCount: prev.userLiked ? prev.likeCount - 1 : prev.likeCount + 1,
              }
            : null,
        );
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback
      prompt('Copy this URL:', url);
    }
  };

  const handleRemoveItem = async (productId: number) => {
    if (!userId || !list || list['userId'] !== userId) return;

    try {
      const response = await fetch(`/api/favorite-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          productId,
          action: 'remove',
        }),
      });

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item['productId'] !== productId));
        setList((prev) => (prev ? { ...prev, itemCount: prev.itemCount - 1 } : null));
        onRemoveItem?.(productId);
      }
    } catch {
      console.error('Failed to remove item');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">{t.loading}</span>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-gray-500 dark:text-gray-400">{error || t.notFound}</p>
        <button onClick={onBack} className="rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
          {t.back}
        </button>
      </div>
    );
  }

  const isOwner = userId === list['userId'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-2 flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </button>

          <div className="mb-1 flex items-center gap-2">
            {list['isPublic'] ? (
              <Globe className="h-5 w-5 text-green-500" />
            ) : (
              <Lock className="h-5 w-5 text-gray-400" />
            )}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{list['title']}</h1>
          </div>

          {list['description'] && <p className="mb-2 text-gray-600 dark:text-gray-400">{list['description']}</p>}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{t.items.replace('{count}', String(list.itemCount))}</span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {t.views.replace('{count}', String(list['viewCount']))}
            </span>
            <span className="flex items-center gap-1">
              <Heart className={`h-4 w-4 ${list.userLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              {t.likes.replace('{count}', String(list['likeCount']))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {list['isPublic'] && (
            <button
              onClick={handleShare}
              className="relative rounded-lg border border-gray-300 p-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Share2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              {showCopied && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white">
                  {t.copied}
                </span>
              )}
            </button>
          )}

          {!isOwner && userId && list['isPublic'] && (
            <button
              onClick={handleLike}
              disabled={isLiking}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                list.userLiked
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                  : 'border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {isLiking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Heart className={`h-5 w-5 ${list.userLiked ? 'fill-current' : ''}`} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t.emptyList}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item['productId']}
              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <button onClick={() => onProductClick(item['productId'])} className="w-full">
                {item.product['thumbnailUrl'] ? (
                  <img
                    src={item.product['thumbnailUrl']}
                    alt={item.product['title']}
                    className="w-full object-cover"
                    style={{ aspectRatio: '3/4' }}
                  />
                ) : (
                  <div
                    className="flex w-full items-center justify-center bg-gray-200 dark:bg-gray-700"
                    style={{ aspectRatio: '3/4' }}
                  >
                    <span className="text-gray-400">No Image</span>
                  </div>
                )}
                <div className="p-2">
                  <p className="line-clamp-2 text-sm text-gray-900 dark:text-white">{item.product['title']}</p>
                </div>
              </button>

              {isOwner && (
                <button
                  onClick={() => handleRemoveItem(item['productId'])}
                  className="absolute top-2 right-2 rounded-full bg-red-500 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title={t.removeItem}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
