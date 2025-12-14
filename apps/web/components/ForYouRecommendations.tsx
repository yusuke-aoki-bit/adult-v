'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import AccordionSection from './AccordionSection';
import ProductCard from './ProductCard';
import ProductSkeleton from './ProductSkeleton';
import type { Product } from '@/types/product';

interface RecommendationMeta {
  id: number;
  matchType: 'favorite_performer' | 'favorite_tag';
  matchScore: number;
}

const translations = {
  ja: {
    title: 'あなたへのおすすめ',
    basedOn: '閲覧履歴に基づくおすすめ',
  },
  en: {
    title: 'Recommended for You',
    basedOn: 'Based on your viewing history',
  },
  zh: {
    title: '为您推荐',
    basedOn: '基于您的浏览历史',
  },
  'zh-TW': {
    title: '為您推薦',
    basedOn: '基於您的瀏覽記錄',
  },
  ko: {
    title: '맞춤 추천',
    basedOn: '조회 기록을 기반으로 한 추천',
  },
} as const;

export default function ForYouRecommendations() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { items: viewedItems, isLoading: isViewedLoading } = useRecentlyViewed();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (viewedItems.length < 2) {
        setProducts([]);
        return;
      }

      setIsLoading(true);

      try {
        // Step 1: おすすめ商品IDリストを取得
        const productIds = viewedItems.slice(0, 10).map(item => item.id);
        const recResponse = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds, limit: 8 }),
        });

        if (!recResponse.ok) {
          throw new Error('Failed to fetch recommendations');
        }

        const recData = await recResponse.json();
        const recommendations: RecommendationMeta[] = recData.recommendations || [];

        if (recommendations.length === 0) {
          setProducts([]);
          return;
        }

        // Step 2: IDリストからフル商品情報を取得
        const ids = recommendations.map(r => r.id).join(',');
        const productsResponse = await fetch(`/api/products?ids=${ids}`);

        if (!productsResponse.ok) {
          throw new Error('Failed to fetch product details');
        }

        const productsData = await productsResponse.json();

        // 推奨順序を維持するためにソート
        const productMap = new Map<number, Product>();
        for (const product of productsData.products) {
          productMap.set(Number(product.id), product);
        }

        const orderedProducts: Product[] = [];
        for (const rec of recommendations) {
          const product = productMap.get(rec.id);
          if (product) {
            orderedProducts.push(product);
          }
        }

        setProducts(orderedProducts);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isViewedLoading) {
      fetchRecommendations();
    }
  }, [viewedItems, isViewedLoading]);

  // Don't render if no viewing history or still loading
  if (isViewedLoading || viewedItems.length < 2) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <AccordionSection
        icon={<Sparkles className="w-5 h-5" />}
        title={t.title}
        defaultOpen={false}
        iconColorClass="text-purple-400"
        bgClass="bg-gradient-to-r from-purple-900/30 to-pink-900/30"
      >
        <ProductSkeleton count={8} />
      </AccordionSection>
    );
  }

  // No recommendations
  if (products.length === 0) {
    return null;
  }

  return (
    <AccordionSection
      icon={<Sparkles className="w-5 h-5" />}
      title={t.title}
      itemCount={products.length}
      defaultOpen={false}
      iconColorClass="text-purple-400"
      bgClass="bg-gradient-to-r from-purple-900/30 to-pink-900/30"
    >
      <p className="text-xs text-gray-500 mb-3">{t.basedOn}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
    </AccordionSection>
  );
}
