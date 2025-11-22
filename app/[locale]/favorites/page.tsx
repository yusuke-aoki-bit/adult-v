'use client';

import { useFavorites } from '@/contexts/FavoritesContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import FavoriteButton from '@/components/FavoriteButton';

interface Actress {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl?: string;
}

interface Product {
  id: string;
  title: string;
  thumbnailUrl?: string;
  normalizedProductId?: string;
}

export default function FavoritesPage() {
  const { favoriteActresses, favoriteProducts } = useFavorites();
  const { locale } = useParams();
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      setLoading(true);

      // Load favorite actresses
      if (favoriteActresses.size > 0) {
        const actressIds = Array.from(favoriteActresses);
        const actressPromises = actressIds.map(async (id) => {
          try {
            const res = await fetch(`/api/actresses/${id}`);
            if (res.ok) {
              return await res.json();
            }
          } catch (error) {
            console.error(`Error loading actress ${id}:`, error);
          }
          return null;
        });
        const loadedActresses = (await Promise.all(actressPromises)).filter(Boolean);
        setActresses(loadedActresses);
      } else {
        setActresses([]);
      }

      // Load favorite products
      if (favoriteProducts.size > 0) {
        const productIds = Array.from(favoriteProducts);
        const productPromises = productIds.map(async (id) => {
          try {
            const res = await fetch(`/api/products/${id}`);
            if (res.ok) {
              return await res.json();
            }
          } catch (error) {
            console.error(`Error loading product ${id}:`, error);
          }
          return null;
        });
        const loadedProducts = (await Promise.all(productPromises)).filter(Boolean);
        setProducts(loadedProducts);
      } else {
        setProducts([]);
      }

      setLoading(false);
    }

    loadFavorites();
  }, [favoriteActresses, favoriteProducts]);

  if (loading) {
    return (
      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">お気に入り</h1>

      {/* Favorite Actresses */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">お気に入りの女優</h2>
        {actresses.length === 0 ? (
          <p className="text-gray-400">お気に入りの女優はまだありません</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {actresses.map((actress) => (
              <div key={actress.id} className="relative group">
                <Link href={`/${locale}/actress/${actress.id}`} className="block">
                  <div className="aspect-[3/4] relative bg-gray-800 rounded-lg overflow-hidden">
                    {actress.thumbnailUrl ? (
                      <Image
                        src={actress.thumbnailUrl}
                        alt={actress.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-750">
                        <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs">画像なし</span>
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-white line-clamp-2">{actress.name}</h3>
                </Link>
                <div className="absolute top-2 right-2 bg-white rounded-full shadow-md">
                  <FavoriteButton type="actress" id={actress.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Favorite Products */}
      <section>
        <h2 className="text-2xl font-semibold text-white mb-4">お気に入りの作品</h2>
        {products.length === 0 ? (
          <p className="text-gray-400">お気に入りの作品はまだありません</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <div key={product.id} className="relative group">
                <Link href={`/${locale}/products/${product.id}`} className="block">
                  <div className="aspect-[3/4] relative bg-gray-800 rounded-lg overflow-hidden">
                    {product.thumbnailUrl ? (
                      <Image
                        src={product.thumbnailUrl}
                        alt={product.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-750">
                        <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">画像なし</span>
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-white line-clamp-2">{product.title}</h3>
                  {product.normalizedProductId && (
                    <p className="text-xs text-gray-400 mt-1">
                      {product.normalizedProductId}
                    </p>
                  )}
                </Link>
                <div className="absolute top-2 right-2 bg-white rounded-full shadow-md">
                  <FavoriteButton type="product" id={product.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
