'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Heart, Trash2, Film, User, ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';
import { useFavorites, useBulkSelection } from '@adult-v/shared/hooks';
import { useWatchlistAnalysis } from '@/hooks';
import { WatchlistAnalysis, BulkActionBar, SelectableCard } from '@adult-v/shared/components';
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
    showAnalysis: '分析を表示',
    hideAnalysis: '分析を非表示',
    recommendations: 'おすすめ',
    selectMode: '選択モード',
    deleteSelected: '選択削除',
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
    showAnalysis: 'Show Analysis',
    hideAnalysis: 'Hide Analysis',
    recommendations: 'Recommendations',
    selectMode: 'Select mode',
    deleteSelected: 'Delete selected',
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
    showAnalysis: '显示分析',
    hideAnalysis: '隐藏分析',
    recommendations: '推荐',
    selectMode: '选择模式',
    deleteSelected: '删除所选',
  },
  'zh-TW': {
    title: '收藏夾',
    loading: '載入中...',
    itemCount: '{count}個收藏項目',
    all: '全部',
    products: '作品',
    actresses: '女優',
    clearAll: '全部刪除',
    confirmTitle: '刪除所有收藏?',
    confirmMessage: '此操作無法撤銷。',
    cancel: '取消',
    delete: '刪除',
    emptyAll: '暫無收藏',
    emptyProducts: '暫無收藏的作品',
    emptyActresses: '暫無收藏的女優',
    showAnalysis: '顯示分析',
    hideAnalysis: '隱藏分析',
    recommendations: '推薦',
    selectMode: '選擇模式',
    deleteSelected: '刪除所選',
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
    showAnalysis: '분석 보기',
    hideAnalysis: '분석 숨기기',
    recommendations: '추천',
    selectMode: '선택 모드',
    deleteSelected: '선택 삭제',
  },
} as const;

function FavoritesSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-gray-700" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-700" />
        </div>
        <div className="h-5 w-48 animate-pulse rounded bg-gray-700" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6 flex gap-2">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-700" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-700" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-700" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/5">
            <div className="aspect-3/4 bg-white/5" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-3 w-20 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  const { favorites, isLoaded, clearFavorites, getFavoritesByType, removeFavorite } = useFavorites();
  const { products: enrichedProducts, isLoading: isLoadingAnalysis } = useWatchlistAnalysis();
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'actress'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);

  // バルク選択機能
  const {
    selectedItems,
    selectedCount,
    isSelectionMode,
    isSelected,
    toggleItem,
    selectAll,
    deselectAll,
    toggleSelectionMode,
    disableSelectionMode,
  } = useBulkSelection({ maxItems: 100 });

  const filteredFavorites = activeTab === 'all' ? favorites : getFavoritesByType(activeTab);

  const productCount = getFavoritesByType('product').length;
  const actressCount = getFavoritesByType('actress').length;

  // お気に入り女優のID一覧（メモ化して無限ループを防止）
  const favoriteActressIds = useMemo(
    () => getFavoritesByType('actress').map((f) => String(f.id)),
    [getFavoritesByType],
  );

  // ロケール別の日付フォーマット
  const dateLocale = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP';

  // 選択したアイテムを一括削除
  const handleBulkDelete = useCallback(() => {
    for (const itemKey of selectedItems) {
      // itemKeyは "type-id" 形式
      const [type, id] = itemKey.split('-');
      if (type && id) {
        removeFavorite(type as 'product' | 'actress', id);
      }
    }
    disableSelectionMode();
  }, [selectedItems, removeFavorite, disableSelectionMode]);

  // 現在表示中のアイテムをすべて選択
  const handleSelectAll = useCallback(() => {
    const ids = filteredFavorites.map((item) => `${item.type}-${item.id}`);
    selectAll(ids);
  }, [filteredFavorites, selectAll]);

  if (!isLoaded) {
    return <FavoritesSkeleton />;
  }

  return (
    <div className="theme-body min-h-screen">
      <div id="favorites" className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
            <Heart className="h-8 w-8 fill-current text-fuchsia-600" />
            {t.title}
          </h1>
          <p className="text-gray-400">{t.itemCount.replace('{count}', String(favorites.length))}</p>
        </div>

        {/* Watchlist Analysis Section */}
        {productCount > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="mb-3 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
            >
              {showAnalysis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAnalysis ? t.hideAnalysis : t.showAnalysis}
            </button>
            {showAnalysis && (
              <div className="transition-all">
                {isLoadingAnalysis ? (
                  <div className="animate-pulse rounded-lg bg-gray-800 p-6">
                    <div className="mb-4 h-6 w-32 rounded bg-gray-700" />
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-gray-750 h-20 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <WatchlistAnalysis products={enrichedProducts} locale={locale} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Actress Recommendations Section - B1機能 */}
        {actressCount > 0 && (
          <div className="mb-6">
            <ActressRecommendations favoritePerformerIds={favoriteActressIds} locale={locale} />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-fuchsia-600 text-white'
                : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
            }`}
          >
            {t.all} ({favorites.length})
          </button>
          <button
            onClick={() => setActiveTab('product')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'product'
                ? 'bg-fuchsia-600 text-white'
                : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
            }`}
          >
            <Film className="h-4 w-4" />
            {t.products} ({productCount})
          </button>
          <button
            onClick={() => setActiveTab('actress')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'actress'
                ? 'bg-fuchsia-600 text-white'
                : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
            }`}
          >
            <User className="h-4 w-4" />
            {t.actresses} ({actressCount})
          </button>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* 選択モードボタン */}
            {favorites.length > 0 && (
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                  isSelectionMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10'
                }`}
              >
                <CheckSquare className="h-4 w-4" />
                {t.selectMode}
              </button>
            )}

            {/* Clear all button */}
            {favorites.length > 0 && !isSelectionMode && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 font-medium text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-red-900/50 hover:text-white hover:ring-red-500/30"
              >
                <Trash2 className="h-4 w-4" />
                {t.clearAll}
              </button>
            )}
          </div>
        </div>

        {/* Clear confirmation dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-gray-900/95 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-xl font-bold text-white">{t.confirmTitle}</h3>
              <p className="mb-6 text-gray-400">{t.confirmMessage}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg bg-white/5 px-4 py-2 text-white ring-1 ring-white/10 transition-colors hover:bg-white/10"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={() => {
                    clearFavorites();
                    setShowClearConfirm(false);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Favorites grid */}
        {filteredFavorites.length === 0 ? (
          <div className="py-16 text-center">
            <Heart className="mx-auto mb-4 h-16 w-16 text-gray-700" />
            <p className="text-lg text-gray-400">
              {activeTab === 'all' ? t.emptyAll : activeTab === 'product' ? t.emptyProducts : t.emptyActresses}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredFavorites.map((item) => {
              const href = item.type === 'product' ? `/${locale}/products/${item.id}` : `/${locale}/actress/${item.id}`;
              const itemKey = `${item.type}-${item.id}`;

              return (
                <SelectableCard
                  key={itemKey}
                  isSelected={isSelected(itemKey)}
                  isSelectionMode={isSelectionMode}
                  onToggle={() => toggleItem(itemKey)}
                  theme="dark"
                >
                  <div className="group relative overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition-all hover:ring-2 hover:ring-fuchsia-600">
                    <Link href={href}>
                      {/* Thumbnail */}
                      <div className="relative aspect-3/4 bg-gray-700">
                        {item.thumbnail || item.image ? (
                          <Image
                            src={item.thumbnail || item.image || ''}
                            alt={item.title || item.name || ''}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {item.type === 'product' ? (
                              <Film className="h-12 w-12 text-gray-600" />
                            ) : (
                              <User className="h-12 w-12 text-gray-600" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Title/Name */}
                      <div className="p-3">
                        <h3 className="mb-1 line-clamp-2 text-sm font-medium text-white">{item.title || item.name}</h3>
                        <p className="text-xs text-gray-500">{new Date(item.addedAt).toLocaleDateString(dateLocale)}</p>
                      </div>
                    </Link>

                    {/* Favorite button overlay - 選択モード中は非表示 */}
                    {!isSelectionMode && (
                      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <FavoriteButton
                          type={item.type}
                          id={item.id}
                          {...(item.title && { title: item.title })}
                          {...(item.name && { name: item.name })}
                          {...(item.thumbnail && { thumbnail: item.thumbnail })}
                          {...(item.image && { image: item.image })}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </SelectableCard>
              );
            })}
          </div>
        )}
      </div>

      {/* バルク選択アクションバー */}
      <BulkActionBar
        selectedCount={selectedCount}
        selectedIds={selectedItems}
        actions={[
          {
            id: 'delete',
            label: t.deleteSelected,
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: handleBulkDelete,
          },
        ]}
        onClearSelection={deselectAll}
        onSelectAll={handleSelectAll}
        totalCount={filteredFavorites.length}
        locale={locale}
        theme="dark"
      />
    </div>
  );
}
