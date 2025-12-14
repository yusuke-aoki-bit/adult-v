'use client';

import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import AccordionSection from './AccordionSection';
import ProductCard from './ProductCard';
import ProductSkeleton from './ProductSkeleton';
import type { Product } from '@/types/product';

const translations = {
  ja: {
    title: '最近見た作品',
    clearAll: 'すべて削除',
    removeFromHistory: '履歴から削除',
  },
  en: {
    title: 'Recently Viewed',
    clearAll: 'Clear all',
    removeFromHistory: 'Remove from history',
  },
  zh: {
    title: '最近浏览',
    clearAll: '全部删除',
    removeFromHistory: '从历史记录中删除',
  },
  'zh-TW': {
    title: '最近瀏覽',
    clearAll: '全部刪除',
    removeFromHistory: '從記錄中刪除',
  },
  ko: {
    title: '최근 본 작품',
    clearAll: '전체 삭제',
    removeFromHistory: '기록에서 삭제',
  },
} as const;

/**
 * 最近見た作品セクション
 * APIからフル情報を取得してProductCardで表示
 * 各カードに削除ボタン付き
 */
export default function RecentlyViewed() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { items, isLoading: isViewedLoading, removeItem, clearAll } = useRecentlyViewed();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // IDリストからフル商品情報を取得
  useEffect(() => {
    const fetchProducts = async () => {
      if (items.length === 0) {
        setProducts([]);
        return;
      }

      setIsLoading(true);
      try {
        const ids = items.slice(0, 8).map(item => item.id).join(',');
        const response = await fetch(`/api/products?ids=${ids}`);

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json();

        // 閲覧順序を維持するためにソート
        const productMap = new Map<string, Product>();
        for (const product of data.products) {
          productMap.set(String(product.id), product);
        }

        const orderedProducts: Product[] = [];
        for (const item of items.slice(0, 8)) {
          const product = productMap.get(item.id);
          if (product) {
            orderedProducts.push(product);
          }
        }

        setProducts(orderedProducts);
      } catch (err) {
        console.error('Failed to fetch recently viewed products:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isViewedLoading) {
      fetchProducts();
    }
  }, [items, isViewedLoading]);

  // ローディング中または履歴がない場合は表示しない
  if (isViewedLoading || items.length === 0) {
    return null;
  }

  // ローディングスケルトン
  if (isLoading) {
    return (
      <AccordionSection
        icon={<Clock className="w-5 h-5" />}
        title={t.title}
        itemCount={items.length}
        defaultOpen={false}
        iconColorClass="text-blue-400"
        bgClass="bg-gray-900/50"
      >
        <ProductSkeleton count={Math.min(items.length, 8)} />
      </AccordionSection>
    );
  }

  return (
    <AccordionSection
      icon={<Clock className="w-5 h-5" />}
      title={t.title}
      itemCount={items.length}
      defaultOpen={false}
      showClear={true}
      clearLabel={t.clearAll}
      onClear={clearAll}
      iconColorClass="text-blue-400"
      bgClass="bg-gray-900/50"
    >
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {products.map((product) => (
          <div key={product.id} className="relative group/card">
            <ProductCard product={product} compact />
            {/* 削除ボタン - カードホバー時に表示 */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeItem(String(product.id));
              }}
              className="absolute top-1 left-1 z-30 w-5 h-5 bg-gray-900/80 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg"
              aria-label={t.removeFromHistory}
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
      </div>
    </AccordionSection>
  );
}
