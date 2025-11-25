'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Trash2, Film, User } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import FavoriteButton from '@/components/FavoriteButton';

export default function FavoritesPage() {
  const { favorites, isLoaded, clearFavorites, getFavoritesByType } = useFavorites();
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'actress'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredFavorites = activeTab === 'all'
    ? favorites
    : getFavoritesByType(activeTab);

  const productCount = getFavoritesByType('product').length;
  const actressCount = getFavoritesByType('actress').length;

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Heart className="h-8 w-8 text-rose-600 fill-current" />
          お気に入り
        </h1>
        <p className="text-gray-400">
          {favorites.length}件のお気に入りアイテム
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          すべて ({favorites.length})
        </button>
        <button
          onClick={() => setActiveTab('product')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'product'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Film className="h-4 w-4" />
          作品 ({productCount})
        </button>
        <button
          onClick={() => setActiveTab('actress')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'actress'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <User className="h-4 w-4" />
          女優 ({actressCount})
        </button>

        {/* Clear all button */}
        {favorites.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="ml-auto px-4 py-2 rounded-lg font-medium bg-gray-800 text-gray-300 hover:bg-red-900 hover:text-white transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            すべて削除
          </button>
        )}
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              お気に入りをすべて削除しますか?
            </h3>
            <p className="text-gray-400 mb-6">
              この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  clearFavorites();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites grid */}
      {filteredFavorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="h-16 w-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">
            {activeTab === 'all'
              ? 'お気に入りはまだありません'
              : activeTab === 'product'
              ? 'お気に入りの作品はまだありません'
              : 'お気に入りの女優はまだありません'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredFavorites.map((item) => {
            const href = item.type === 'product'
              ? `/ja/products/${item.id}`
              : `/ja/actress/${item.id}`;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-600 transition-all group relative"
              >
                <Link href={href}>
                  {/* Thumbnail */}
                  <div className="aspect-[3/4] relative bg-gray-700">
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
                          <Film className="h-12 w-12 text-gray-600" />
                        ) : (
                          <User className="h-12 w-12 text-gray-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title/Name */}
                  <div className="p-3">
                    <h3 className="text-white text-sm font-medium line-clamp-2 mb-1">
                      {item.title || item.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(item.addedAt).toLocaleDateString('ja-JP')}
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
