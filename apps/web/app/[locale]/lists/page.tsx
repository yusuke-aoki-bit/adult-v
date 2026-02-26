'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { List, Plus, Loader2 } from 'lucide-react';
import { usePublicLists } from '@adult-v/shared/hooks';
import { PublicListCard, CreateListModal, HomeSectionManager } from '@adult-v/shared/components';
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
    // PublicListCard translations
    card: {
      items: '{count}件',
      views: '閲覧',
      likes: 'いいね',
      private: '非公開',
      public: '公開',
      edit: '編集',
      delete: '削除',
      deleteConfirm: 'このリストを削除しますか？',
    },
    // CreateListModal translations
    modal: {
      createTitle: 'リストを作成',
      editTitle: 'リストを編集',
      titleLabel: 'タイトル',
      titlePlaceholder: 'リストの名前を入力',
      descriptionLabel: '説明',
      descriptionPlaceholder: 'リストの説明を入力（任意）',
      visibilityLabel: '公開設定',
      public: '公開',
      publicDescription: '誰でも閲覧可能',
      private: '非公開',
      privateDescription: '自分だけが閲覧可能',
      cancel: 'キャンセル',
      create: '作成',
      save: '保存',
      creating: '作成中...',
      saving: '保存中...',
    },
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
    card: {
      items: '{count} items',
      views: 'views',
      likes: 'likes',
      private: 'Private',
      public: 'Public',
      edit: 'Edit',
      delete: 'Delete',
      deleteConfirm: 'Delete this list?',
    },
    modal: {
      createTitle: 'Create List',
      editTitle: 'Edit List',
      titleLabel: 'Title',
      titlePlaceholder: 'Enter list name',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Enter description (optional)',
      visibilityLabel: 'Visibility',
      public: 'Public',
      publicDescription: 'Anyone can view',
      private: 'Private',
      privateDescription: 'Only you can view',
      cancel: 'Cancel',
      create: 'Create',
      save: 'Save',
      creating: 'Creating...',
      saving: 'Saving...',
    },
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
    card: {
      items: '{count}个',
      views: '浏览',
      likes: '喜欢',
      private: '私密',
      public: '公开',
      edit: '编辑',
      delete: '删除',
      deleteConfirm: '删除此列表？',
    },
    modal: {
      createTitle: '创建列表',
      editTitle: '编辑列表',
      titleLabel: '标题',
      titlePlaceholder: '输入列表名称',
      descriptionLabel: '描述',
      descriptionPlaceholder: '输入描述（可选）',
      visibilityLabel: '可见性',
      public: '公开',
      publicDescription: '所有人可见',
      private: '私密',
      privateDescription: '仅自己可见',
      cancel: '取消',
      create: '创建',
      save: '保存',
      creating: '创建中...',
      saving: '保存中...',
    },
  },
  'zh-TW': {
    title: '公開列表',
    description: '探索使用者建立的推薦列表',
    myLists: '我的列表',
    publicLists: '公開列表',
    createList: '新建',
    loading: '載入中...',
    empty: '沒有列表',
    emptyPublic: '暫無公開列表',
    emptyMy: '建立你的第一個列表',
    loginToCreate: '登入以建立列表',
    error: '發生錯誤',
    deleteConfirm: '刪除此列表？',
    card: {
      items: '{count}個',
      views: '瀏覽',
      likes: '喜歡',
      private: '私密',
      public: '公開',
      edit: '編輯',
      delete: '刪除',
      deleteConfirm: '刪除此列表？',
    },
    modal: {
      createTitle: '建立列表',
      editTitle: '編輯列表',
      titleLabel: '標題',
      titlePlaceholder: '輸入列表名稱',
      descriptionLabel: '描述',
      descriptionPlaceholder: '輸入描述（選填）',
      visibilityLabel: '可見性',
      public: '公開',
      publicDescription: '所有人可見',
      private: '私密',
      privateDescription: '僅自己可見',
      cancel: '取消',
      create: '建立',
      save: '儲存',
      creating: '建立中...',
      saving: '儲存中...',
    },
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
    card: {
      items: '{count}개',
      views: '조회',
      likes: '좋아요',
      private: '비공개',
      public: '공개',
      edit: '편집',
      delete: '삭제',
      deleteConfirm: '이 리스트를 삭제하시겠습니까?',
    },
    modal: {
      createTitle: '리스트 만들기',
      editTitle: '리스트 편집',
      titleLabel: '제목',
      titlePlaceholder: '리스트 이름 입력',
      descriptionLabel: '설명',
      descriptionPlaceholder: '설명 입력(선택)',
      visibilityLabel: '공개 설정',
      public: '공개',
      publicDescription: '누구나 볼 수 있음',
      private: '비공개',
      privateDescription: '나만 볼 수 있음',
      cancel: '취소',
      create: '만들기',
      save: '저장',
      creating: '만드는 중...',
      saving: '저장 중...',
    },
  },
} as const;

export default function ListsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations['ja'];

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
  const [editingList, setEditingList] = useState<{
    id: number;
    title: string;
    description: string;
    isPublic: boolean;
  } | null>(null);

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
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
            <List className="h-8 w-8 text-fuchsia-500" />
            {t.title}
          </h1>
          <p className="text-gray-400">{t.description}</p>
        </div>

        {/* Tabs and Create Button */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('public')}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                activeTab === 'public'
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
              }`}
            >
              {t.publicLists}
            </button>
            {userId && (
              <button
                onClick={() => setActiveTab('my')}
                className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                  activeTab === 'my'
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
                }`}
              >
                {t.myLists} ({myLists.length})
              </button>
            )}
          </div>

          {userId ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 font-medium text-white transition-colors hover:bg-fuchsia-700"
            >
              <Plus className="h-4 w-4" />
              {t.createList}
            </button>
          ) : (
            !isAuthLoading && <p className="text-sm text-gray-500">{t.loginToCreate}</p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="py-8 text-center text-red-400">
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
          <div className="py-16 text-center">
            <List className="mx-auto mb-4 h-16 w-16 text-gray-700" />
            <p className="text-lg text-gray-400">{activeTab === 'public' ? t.emptyPublic : t.emptyMy}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayLists.map((list) => (
              <PublicListCard
                key={list.id}
                list={list}
                currentUserId={userId}
                onView={(listId) => router.push(`/${locale}/lists/${listId}`)}
                onLike={(id, action) => toggleLike(id, action === 'like')}
                onEdit={() => handleEditList(list)}
                onDelete={handleDeleteList}
                translations={t.card}
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
        editingList={editingList}
        translations={t.modal}
      />

      {/* セクションカスタマイズ */}
      <div className="container mx-auto px-4 pb-8">
        <HomeSectionManager locale={locale} theme="dark" pageId="lists" />
      </div>
    </div>
  );
}
