'use client';

import { useParams, useRouter } from 'next/navigation';
import { PublicListDetail } from '@adult-v/shared/components';
import { useFirebaseAuth } from '@adult-v/shared/contexts';

const translations = {
  ja: {
    loading: '読み込み中...',
    error: 'エラーが発生しました',
    notFound: 'リストが見つかりません',
    back: '戻る',
    views: '{count}回閲覧',
    likes: '{count}いいね',
    items: '{count}件',
    private: '非公開',
    public: '公開',
    share: '共有',
    copied: 'コピーしました',
    emptyList: 'このリストにはアイテムがありません',
    removeItem: 'リストから削除',
  },
  en: {
    loading: 'Loading...',
    error: 'An error occurred',
    notFound: 'List not found',
    back: 'Back',
    views: '{count} views',
    likes: '{count} likes',
    items: '{count} items',
    private: 'Private',
    public: 'Public',
    share: 'Share',
    copied: 'Copied',
    emptyList: 'This list is empty',
    removeItem: 'Remove from list',
  },
  zh: {
    loading: '加载中...',
    error: '发生错误',
    notFound: '列表未找到',
    back: '返回',
    views: '{count}次浏览',
    likes: '{count}个赞',
    items: '{count}项',
    private: '私密',
    public: '公开',
    share: '分享',
    copied: '已复制',
    emptyList: '此列表为空',
    removeItem: '从列表中删除',
  },
  ko: {
    loading: '로딩 중...',
    error: '오류가 발생했습니다',
    notFound: '리스트를 찾을 수 없습니다',
    back: '뒤로',
    views: '{count}회 조회',
    likes: '{count}개 좋아요',
    items: '{count}개',
    private: '비공개',
    public: '공개',
    share: '공유',
    copied: '복사됨',
    emptyList: '이 리스트는 비어 있습니다',
    removeItem: '리스트에서 삭제',
  },
} as const;

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.['locale'] as string) || 'ja';
  const listId = parseInt(params?.['id'] as string, 10);
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  const { user } = useFirebaseAuth();
  const userId = user?.uid ?? null;

  const handleBack = () => {
    router.push(`/${locale}/lists`);
  };

  const handleProductClick = (productId: number) => {
    router.push(`/${locale}/products/${productId}`);
  };

  if (isNaN(listId)) {
    return (
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-400">{t.notFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <PublicListDetail
          listId={listId}
          userId={userId}
          onBack={handleBack}
          onProductClick={handleProductClick}
          translations={t}
        />
      </div>
    </div>
  );
}
