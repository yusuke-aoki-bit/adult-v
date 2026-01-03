'use client';

import { useState, useEffect } from 'react';
import { ListPlus, Check, Loader2, Plus, X } from 'lucide-react';

interface UserList {
  id: number;
  title: string;
  isPublic: boolean;
  itemCount?: number;
}

export interface AddToListButtonProps {
  productId: number;
  userId: string | null;
  onLoginRequired?: () => void;
  translations: {
    addToList: string;
    selectList: string;
    createNew: string;
    noLists: string;
    added: string;
    removed: string;
    loading: string;
    newListTitle: string;
    create: string;
    cancel: string;
    loginRequired: string;
  };
}

export function AddToListButton({
  productId,
  userId,
  onLoginRequired,
  translations: t,
}: AddToListButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [productInLists, setProductInLists] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [actionListId, setActionListId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchLists();
    }
  }, [isOpen, userId]);

  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/favorite-lists?myLists=true&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setLists(data.lists || []);
        // TODO: Check which lists contain this product
      }
    } catch {
      console.error('Failed to fetch lists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleList = async (listId: number) => {
    if (!userId) return;

    setActionListId(listId);
    const isInList = productInLists.has(listId);

    try {
      const response = await fetch(`/api/favorite-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          productId,
          action: isInList ? 'remove' : 'add',
        }),
      });

      if (response.ok) {
        setProductInLists((prev) => {
          const next = new Set(prev);
          if (isInList) {
            next.delete(listId);
          } else {
            next.add(listId);
          }
          return next;
        });
      }
    } catch {
      console.error('Failed to toggle list');
    } finally {
      setActionListId(null);
    }
  };

  const handleCreateList = async () => {
    if (!userId || newListTitle.trim().length < 2) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/favorite-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: newListTitle.trim(),
          isPublic: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLists((prev) => [data.list, ...prev]);
        setNewListTitle('');
        setShowCreateForm(false);

        // Auto-add product to new list
        await handleToggleList(data.list.id);
      }
    } catch {
      console.error('Failed to create list');
    } finally {
      setIsCreating(false);
    }
  };

  const handleButtonClick = () => {
    if (!userId) {
      onLoginRequired?.();
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleButtonClick}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <ListPlus className="w-4 h-4" />
        {t.addToList}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.selectList}
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : lists.length === 0 && !showCreateForm ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {t.noLists}
                </p>
              ) : (
                <div className="space-y-1">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleToggleList(list.id)}
                      disabled={actionListId === list.id}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="truncate text-gray-900 dark:text-white">
                        {list.title}
                      </span>
                      {actionListId === list.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : productInLists.has(list.id) ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new list form */}
              {showCreateForm ? (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder={t.newListTitle}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={handleCreateList}
                      disabled={isCreating || newListTitle.trim().length < 2}
                      className="flex-1 px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:bg-gray-400"
                    >
                      {isCreating ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        t.create
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t.createNew}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
