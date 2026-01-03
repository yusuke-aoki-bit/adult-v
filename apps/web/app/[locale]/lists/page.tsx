'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { List, Plus, Loader2 } from 'lucide-react';
import { usePublicLists } from '@adult-v/shared/hooks';
import { PublicListCard, CreateListModal } from '@adult-v/shared/components';
import { useFirebaseAuth } from '@adult-v/shared/contexts';

const translations = {
  ja: {
    title: '公開リスト',
    description: 'ユーザーが作成したおすすめリストを探索',
    myLists: 'マイリスト',
    publicLists: '公開リスト',
    createList: '新規作成',
    loading: '読み込み中...',
    empty: 'リストがありません',
    emptyPublic: '公開リストがまだありません',
    emptyMy: 'リストを作成してみましょう',
    loginToCreate: 'ログインしてリストを作成',
    error: 'エラーが発生しました',
    deleteConfirm: 'このリストを削除しますか？',
  },
  en: {
    title: 'Public Lists',
    description: 'Explore curated lists from users',
    myLists: 'My Lists',
    publicLists: 'Public Lists',
    createList: 'Create',
    loading: 'Loading...',
    empty: 'No lists',
    emptyPublic: 'No public lists yet',
    emptyMy: 'Create your first list',
    loginToCreate: 'Login to create lists',
    error: 'An error occurred',
    deleteConfirm: 'Delete this list?',
  },
  zh: {
    title: '公开列表',
    description: '探索用户创建的推荐列表',
    myLists: '我的列表',
    publicLists: '公开列表',
    createList: '新建',
    loading: '加载中...',
    empty: '没有列表',
    emptyPublic: '暂无公开列表',
    emptyMy: '创建你的第一个列表',
    loginToCreate: '登录以创建列表',
    error: '发生错误',
    deleteConfirm: '删除此列表？',
  },
  ko: {
    title: '공개 리스트',
    description: '사용자가 만든 추천 리스트 탐색',
    myLists: '내 리스트',
    publicLists: '공개 리스트',
    createList: '만들기',
    loading: '로딩 중...',
    empty: '리스트 없음',
    emptyPublic: '공개 리스트가 없습니다',
    emptyMy: '첫 번째 리스트를 만들어보세요',
    loginToCreate: '로그인하여 리스트 만들기',
    error: '오류가 발생했습니다',
    deleteConfirm: '이 리스트를 삭제하시겠습니까?',
  },
} as const;

export default function ListsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const { user, isLoading: isAuthLoading } = useFirebaseAuth();
  const userId = user?.uid ?? null;

  const {
    lists,
    myLists,
    isLoading,
    error,
    fetchPublicLists,
    fetchMyLists,
    createList,
    updateList,
    deleteList,
    toggleLike,
  } = usePublicLists({ userId, autoFetch: false });

  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingList, setEditingList] = useState<{ id: number; title: string; description: string; isPublic: boolean } | null>(null);

  // 初期データ取得
  useEffect(() => {
    fetchPublicLists();
  }, [fetchPublicLists]);

  useEffect(() => {
    if (userId) {
      fetchMyLists();
    }
  }, [userId, fetchMyLists]);

  const handleCreateList = async (data: { title: string; description: string; isPublic: boolean }) => {
    if (editingList) {
      await updateList(editingList.id, data);
      setEditingList(null);
    } else {
      await createList(data);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (confirm(t.deleteConfirm)) {
      await deleteList(listId);
    }
  };

  const handleEditList = (list: { id: number; title: string; description: string | null; isPublic: boolean }) => {
    setEditingList({
      id: list.id,
      title: list.title,
      description: list.description ?? '',
      isPublic: list.isPublic,
    });
  };

  const displayLists = activeTab === 'public' ? lists : myLists;

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <List className="h-8 w-8 text-rose-500" />
            {t.title}
          </h1>
          <p className="text-gray-400">{t.description}</p>
        </div>

        {/* Tabs and Create Button */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('public')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'public'
                  ? 'bg-rose-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.publicLists}
            </button>
            {userId && (
              <button
                onClick={() => setActiveTab('my')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'my'
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.myLists} ({myLists.length})
              </button>
            )}
          </div>

          {userId ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t.createList}
            </button>
          ) : !isAuthLoading && (
            <p className="text-sm text-gray-500">{t.loginToCreate}</p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-red-400">
            {t.error}: {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">{t.loading}</span>
          </div>
        )}

        {/* Lists Grid */}
        {!isLoading && displayLists.length === 0 ? (
          <div className="text-center py-16">
            <List className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {activeTab === 'public' ? t.emptyPublic : t.emptyMy}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayLists.map((list) => (
              <PublicListCard
                key={list.id}
                list={list}
                locale={locale}
                theme="dark"
                isOwner={list.userId === userId}
                onLike={(id, liked) => toggleLike(id, liked)}
                onEdit={() => handleEditList(list)}
                onDelete={handleDeleteList}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CreateListModal
        isOpen={showCreateModal || editingList !== null}
        onClose={() => {
          setShowCreateModal(false);
          setEditingList(null);
        }}
        onSubmit={handleCreateList}
        locale={locale}
        theme="dark"
        mode={editingList ? 'edit' : 'create'}
        initialData={editingList ?? undefined}
      />
    </div>
  );
}
