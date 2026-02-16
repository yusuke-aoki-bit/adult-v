'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ProductCard from './ProductCard';
import { ProductListWithSelection } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

interface Product {
  id: number | string;
  title: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

interface LoadMoreProductsProps {
  initialProducts: Product[];
  totalCount: number;
  perPage: number;
  locale: string;
  filterParams: Record<string, string>;
  className?: string;
}

export default function LoadMoreProducts({
  initialProducts,
  totalCount,
  perPage,
  locale,
  filterParams,
  className,
}: LoadMoreProductsProps) {
  const t = useTranslations('products');
  const theme = useSiteTheme();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length < totalCount);
  const [hasError, setHasError] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 競合状態防止用のref（最新の値を追跡）
  const productsLengthRef = useRef(products.length);
  productsLengthRef.current = products.length;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setHasError(false);
    try {
      const nextPage = page + 1;
      const offset = nextPage * perPage; // page=1なら offset=perPage (初期表示分の次から)
      const params = new URLSearchParams({
        ...filterParams,
        offset: String(offset),
        limit: String(perPage),
      });

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const newProducts = Array.isArray(data.products) ? data.products : [];

      if (newProducts.length === 0) {
        setHasMore(false);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
        setPage(nextPage);

        // refを使用して最新の値を取得（競合状態防止）
        const totalLoaded = productsLengthRef.current + newProducts.length;
        if (totalLoaded >= totalCount) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading more products:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore, filterParams, perPage, totalCount]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  const remainingCount = totalCount - products.length;

  return (
    <div>
      <ProductListWithSelection
        products={products}
        locale={locale}
        theme={theme}
        className={className}
      >
        {(product, index) => (
          <ProductCard
            key={product.id}
            product={product as Parameters<typeof ProductCard>[0]['product']}
            priority={index < 6}
          />
        )}
      </ProductListWithSelection>

      {/* Loading indicator & Load more trigger */}
      <div ref={observerTarget} className="mt-8 flex flex-col items-center gap-4">
        {isLoading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-rose-500 rounded-full animate-spin" />
            <span>{t('loading')}</span>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-red-400 text-sm">{t('loadError') || '読み込みに失敗しました'}</p>
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              {t('retry') || '再試行'}
            </button>
          </div>
        )}

        {hasMore && !isLoading && !hasError && (
          <button
            onClick={loadMore}
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 hover:border-rose-500"
          >
            {t('loadMore', { count: Math.min(perPage, remainingCount) })}
          </button>
        )}

        {!hasMore && products.length > 0 && (
          <p className="text-gray-500 text-sm">
            {t('allLoaded', { count: products.length })}
          </p>
        )}
      </div>
    </div>
  );
}
