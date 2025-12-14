'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Heart, Trash2, Film, User } from 'lucide-react';
import { useFavorites } from '@adult-v/ui-common/hooks';
import FavoriteButton from '@/components/FavoriteButton';
import ActressRecommendations from '@/components/ActressRecommendations';

const translations = {
  ja: {
    title: 'お気に入り',
    loading: '読み込み中...',
    itemCount: '{count}件のお気に入りアイテム',
    all: 'すべて',
    products: '作品',
    actresses: '女優',
    clearAll: 'すべて削除',
    confirmTitle: 'お気に入りをすべて削除しますか?',
    confirmMessage: 'この操作は取り消せません。',
    cancel: 'キャンセル',
    delete: '削除する',
    emptyAll: 'お気に入りはまだありません',
    emptyProducts: 'お気に入りの作品はまだありません',
    emptyActresses: 'お気に入りの女優はまだありません',
  },
  en: {
    title: 'Favorites',
    loading: 'Loading...',
    itemCount: '{count} favorite items',
    all: 'All',
    products: 'Products',
    actresses: 'Actresses',
    clearAll: 'Clear all',
    confirmTitle: 'Delete all favorites?',
    confirmMessage: 'This action cannot be undone.',
    cancel: 'Cancel',
    delete: 'Delete',
    emptyAll: 'No favorites yet',
    emptyProducts: 'No favorite products yet',
    emptyActresses: 'No favorite actresses yet',
  },
  zh: {
    title: '收藏夹',
    loading: '加载中...',
    itemCount: '{count}个收藏项目',
    all: '全部',
    products: '作品',
    actresses: '女优',
    clearAll: '全部删除',
    confirmTitle: '删除所有收藏?',
    confirmMessage: '此操作无法撤销。',
    cancel: '取消',
    delete: '删除',
    emptyAll: '暂无收藏',
    emptyProducts: '暂无收藏的作品',
    emptyActresses: '暂无收藏的女优',
  },
  ko: {
    title: '즐겨찾기',
    loading: '로딩 중...',
    itemCount: '{count}개의 즐겨찾기 항목',
    all: '전체',
    products: '작품',
    actresses: '여배우',
    clearAll: '전체 삭제',
    confirmTitle: '모든 즐겨찾기를 삭제하시겠습니까?',
    confirmMessage: '이 작업은 취소할 수 없습니다.',
    cancel: '취소',
    delete: '삭제',
    emptyAll: '즐겨찾기가 없습니다',
    emptyProducts: '즐겨찾기한 작품이 없습니다',
    emptyActresses: '즐겨찾기한 여배우가 없습니다',
  },
} as const;

function FavoritesSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse border border-gray-200">
            <div className="aspect-3/4 bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const { favorites, isLoaded, clearFavorites, getFavoritesByType } = useFavorites();
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'actress'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredFavorites = activeTab === 'all'
    ? favorites
    : getFavoritesByType(activeTab);

  const productCount = getFavoritesByType('product').length;
  const actressCount = getFavoritesByType('actress').length;

  // お気に入り女優のID一覧
  const favoriteActressIds = getFavoritesByType('actress').map(f => String(f.id));

  // ロケール別の日付フォーマット
  const dateLocale = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP';

  if (!isLoaded) {
    return <FavoritesSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
          <Heart className="h-8 w-8 text-rose-700 fill-current" />
          {t.title}
        </h1>
        <p className="text-gray-500">
          {t.itemCount.replace('{count}', String(favorites.length))}
        </p>
      </div>

      {/* Actress Recommendations Section - B1機能 */}
      {actressCount > 0 && (
        <div className="mb-6">
          <ActressRecommendations
            favoritePerformerIds={favoriteActressIds}
            locale={locale}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-rose-700 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t.all} ({favorites.length})
        </button>
        <button
          onClick={() => setActiveTab('product')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'product'
              ? 'bg-rose-700 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Film className="h-4 w-4" />
          {t.products} ({productCount})
        </button>
        <button
          onClick={() => setActiveTab('actress')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'actress'
              ? 'bg-rose-700 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <User className="h-4 w-4" />
          {t.actresses} ({actressCount})
        </button>

        {/* Clear all button */}
        {favorites.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="ml-auto px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {t.clearAll}
          </button>
        )}
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {t.confirmTitle}
            </h3>
            <p className="text-gray-600 mb-6">
              {t.confirmMessage}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  clearFavorites();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites grid */}
      {filteredFavorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {activeTab === 'all'
              ? t.emptyAll
              : activeTab === 'product'
              ? t.emptyProducts
              : t.emptyActresses}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredFavorites.map((item) => {
            const href = item.type === 'product'
              ? `/${locale}/products/${item.id}`
              : `/${locale}/actress/${item.id}`;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:ring-2 hover:ring-rose-700 transition-all group relative"
              >
                <Link href={href}>
                  {/* Thumbnail */}
                  <div className="aspect-3/4 relative bg-gray-100">
                    {(item.thumbnail || item.image) ? (
                      <Image
                        src={item.thumbnail || item.image || ''}
                        alt={item.title || item.name || ''}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {item.type === 'product' ? (
                          <Film className="h-12 w-12 text-gray-400" />
                        ) : (
                          <User className="h-12 w-12 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title/Name */}
                  <div className="p-3">
                    <h3 className="text-gray-800 text-sm font-medium line-clamp-2 mb-1">
                      {item.title || item.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(item.addedAt).toLocaleDateString(dateLocale)}
                    </p>
                  </div>
                </Link>

                {/* Favorite button overlay */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <FavoriteButton
                    type={item.type}
                    id={item.id}
                    title={item.title}
                    name={item.name}
                    thumbnail={item.thumbnail}
                    image={item.image}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
