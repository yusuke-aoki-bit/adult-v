'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Heart, Trash2, Film, User } from 'lucide-react';
import { useFavorites } from '@adult-v/shared/hooks';
import '@adult-v/shared/components';
import '@/hooks';
import FavoriteButton from '@/components/FavoriteButton';
import ActressRecommendations from '@/components/ActressRecommendations';
import { localizedHref } from '@adult-v/shared/i18n';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import { PageSectionNav } from '@adult-v/shared/components';

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

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
  'zh-TW': {
    title: '收藏夾',
    loading: '載入中...',
    itemCount: '{count}個收藏項目',
    all: '全部',
    products: '作品',
    actresses: '女優',
    clearAll: '全部刪除',
    confirmTitle: '刪除所有收藏？',
    confirmMessage: '此操作無法撤銷。',
    cancel: '取消',
    delete: '刪除',
    emptyAll: '暫無收藏',
    emptyProducts: '暫無收藏的作品',
    emptyActresses: '暫無收藏的女優',
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
        <div className="mb-2 flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6 flex gap-2">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="aspect-3/4 bg-gray-200" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-200" />
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

  // PageLayout用のデータ
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    fetch('/api/products/on-sale?limit=24&minDiscount=30')
      .then((res) => res.json())
      .then((data) => setSaleProducts(data.products || []))
      .catch(() => {});

    fetch('/api/products/uncategorized-count')
      .then((res) => res.json())
      .then((data) => setUncategorizedCount(data.count || 0))
      .catch(() => {});
  }, []);

  const layoutTranslations = {
    viewProductList: '作品一覧',
    viewProductListDesc: 'FANZAの全作品を検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  const filteredFavorites = activeTab === 'all' ? favorites : getFavoritesByType(activeTab);

  const productCount = getFavoritesByType('product').length;
  const actressCount = getFavoritesByType('actress').length;

  // お気に入り女優のID一覧
  const favoriteActressIds = getFavoritesByType('actress').map((f) => String(f.id));

  // ロケール別の日付フォーマット
  const dateLocale = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP';

  if (!isLoaded) {
    return <FavoritesSkeleton />;
  }

  // セクションナビゲーション用の翻訳
  const sectionLabels: Record<string, Record<string, string>> = {
    ja: { favorites: 'お気に入り' },
    en: { favorites: 'Favorites' },
    zh: { favorites: '收藏夹' },
    'zh-TW': { favorites: '收藏夾' },
    ko: { favorites: '즐겨찾기' },
  };

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション */}
      <PageSectionNav
        locale={locale}
        config={{
          hasSale: saleProducts.length > 0,
          hasRecentlyViewed: true,
          mainSectionId: 'favorites',
          mainSectionLabel: sectionLabels[locale]?.favorites ?? sectionLabels['ja']!['favorites']!,
          hasRecommendations: true,
          hasWeeklyHighlights: true,
          hasTrending: true,
          hasAllProducts: true,
        }}
        theme="light"
        pageId="favorites"
      />

      {/* 上部セクション（セール中・最近見た作品） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="favorites" />
        </div>
      </section>

      <div id="favorites" className="container mx-auto scroll-mt-20 px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-gray-800">
            <Heart className="h-8 w-8 fill-current text-rose-700" />
            {t.title}
          </h1>
          <p className="text-gray-500">{t.itemCount.replace('{count}', String(favorites.length))}</p>
        </div>

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
              activeTab === 'all' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.all} ({favorites.length})
          </button>
          <button
            onClick={() => setActiveTab('product')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'product' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Film className="h-4 w-4" />
            {t.products} ({productCount})
          </button>
          <button
            onClick={() => setActiveTab('actress')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'actress' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <User className="h-4 w-4" />
            {t.actresses} ({actressCount})
          </button>

          {/* Clear all button */}
          {favorites.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="ml-auto flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-red-100 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {t.clearAll}
            </button>
          )}
        </div>

        {/* Clear confirmation dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
              <h3 className="mb-4 text-xl font-bold text-gray-800">{t.confirmTitle}</h3>
              <p className="mb-6 text-gray-600">{t.confirmMessage}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
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
            <Heart className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-lg text-gray-500">
              {activeTab === 'all' ? t.emptyAll : activeTab === 'product' ? t.emptyProducts : t.emptyActresses}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredFavorites.map((item) => {
              const href =
                item.type === 'product'
                  ? localizedHref(`/products/${item.id}`, locale)
                  : localizedHref(`/actress/${item.id}`, locale);

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:ring-2 hover:ring-rose-700"
                >
                  <Link href={href}>
                    {/* Thumbnail */}
                    <div className="relative aspect-3/4 bg-gray-100">
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
                            <Film className="h-12 w-12 text-gray-400" />
                          ) : (
                            <User className="h-12 w-12 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Title/Name */}
                    <div className="p-3">
                      <h3 className="mb-1 line-clamp-2 text-sm font-medium text-gray-800">{item.title || item.name}</h3>
                      <p className="text-xs text-gray-500">{new Date(item.addedAt).toLocaleDateString(dateLocale)}</p>
                    </div>
                  </Link>

                  {/* Favorite button overlay */}
                  <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
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

      {/* 下部セクション（おすすめ・注目・トレンド・リンク） */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={false}
            translations={layoutTranslations}
            pageId="favorites"
          />
        </div>
      </section>
    </div>
  );
}
