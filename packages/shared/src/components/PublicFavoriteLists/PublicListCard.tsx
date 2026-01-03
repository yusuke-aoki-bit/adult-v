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
  const isOwner = currentUserId === list.userId;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || isOwner || isLiking) return;

    setIsLiking(true);
    try {
      await onLike?.(list.id, list.userLiked ? 'unlike' : 'like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm(t.deleteConfirm)) {
      onDelete?.(list.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(list.id);
  };

  return (
    <div
      onClick={() => onView(list.id)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer relative group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {list.isPublic ? (
            <Globe className="w-4 h-4 text-green-500" />
          ) : (
            <Lock className="w-4 h-4 text-gray-400" />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
            {list.title}
          </h3>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Edit className="w-4 h-4" />
                  {t.edit}
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.delete}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {list.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {list.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{t.items.replace('{count}', String(list.itemCount || 0))}</span>
        <span className="flex items-center gap-1">
          <Eye className="w-4 h-4" />
          {list.viewCount}
        </span>
        <button
          onClick={handleLike}
          disabled={!currentUserId || isOwner || isLiking}
          className={`flex items-center gap-1 transition-colors ${
            list.userLiked
              ? 'text-rose-500'
              : 'hover:text-rose-500 disabled:cursor-default'
          }`}
        >
          <Heart className={`w-4 h-4 ${list.userLiked ? 'fill-rose-500' : ''}`} />
          {list.likeCount}
        </button>
      </div>
    </div>
  );
}
