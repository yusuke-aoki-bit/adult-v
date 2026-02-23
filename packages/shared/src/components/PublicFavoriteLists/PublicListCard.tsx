'use client';

import { Heart, Eye, Lock, Globe, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface PublicListCardProps {
  list: {
    id: number;
    userId: string;
    title: string;
    description: string | null;
    isPublic: boolean;
    viewCount: number;
    likeCount: number;
    createdAt: string;
    itemCount?: number;
    userLiked?: boolean;
  };
  currentUserId: string | null;
  onView: (listId: number) => void;
  onEdit?: (listId: number) => void;
  onDelete?: (listId: number) => void;
  onLike?: (listId: number, action: 'like' | 'unlike') => void;
  translations: {
    items: string;
    views: string;
    likes: string;
    private: string;
    public: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
}

export function PublicListCard({
  list,
  currentUserId,
  onView,
  onEdit,
  onDelete,
  onLike,
  translations: t,
}: PublicListCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const isOwner = currentUserId === list['userId'];

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || isOwner || isLiking) return;

    setIsLiking(true);
    try {
      await onLike?.(list['id'], list.userLiked ? 'unlike' : 'like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm(t.deleteConfirm)) {
      onDelete?.(list['id']);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(list['id']);
  };

  return (
    <div
      onClick={() => onView(list['id'])}
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {list['isPublic'] ? <Globe className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-gray-400" />}
          <h3 className="line-clamp-1 font-semibold text-gray-900 dark:text-white">{list['title']}</h3>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical className="h-4 w-4 text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute top-8 right-0 z-10 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Edit className="h-4 w-4" />
                  {t.edit}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.delete}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {list['description'] && (
        <p className="mb-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{list['description']}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{t.items.replace('{count}', String(list.itemCount || 0))}</span>
        <span className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          {list['viewCount']}
        </span>
        <button
          onClick={handleLike}
          disabled={!currentUserId || isOwner || isLiking}
          className={`flex items-center gap-1 transition-colors ${
            list.userLiked ? 'text-rose-500' : 'hover:text-rose-500 disabled:cursor-default'
          }`}
        >
          <Heart className={`h-4 w-4 ${list.userLiked ? 'fill-rose-500' : ''}`} />
          {list['likeCount']}
        </button>
      </div>
    </div>
  );
}
