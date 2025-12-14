'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import AccordionSection from './AccordionSection';
import ProductCard from './ProductCard';
import type { Product } from '@/types/product';

interface PersonalizedRecommendationsProps {
  className?: string;
  /** デフォルトで開いた状態にするか */
  defaultOpen?: boolean;
}

/**
 * 閲覧履歴に基づくパーソナライズドおすすめセクション
 * localStorageの閲覧履歴から最近見た商品を表示
 * AccordionSectionで折りたたみ可能
 */
export default function PersonalizedRecommendations({
  className = '',
  defaultOpen = false,
}: PersonalizedRecommendationsProps) {
  const t = useTranslations('personalized');
  const { items, isLoading, clearAll } = useRecentlyViewed();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (isLoading || items.length === 0) return;

    // 履歴から最新8件を取得してProductCardの形式に変換
    const products: Product[] = items.slice(0, 8).map(item => ({
      id: item.id,
      title: item.title,
      description: '',
      price: 0,
      category: 'all' as const,
      imageUrl: item.imageUrl || '',
      affiliateUrl: '',
      provider: 'fanza' as const,
      providerLabel: 'FANZA',
    }));

    setRecentProducts(products);
  }, [items, isLoading]);

  // 履歴がない場合は表示しない
  if (isLoading || items.length === 0) return null;

  return (
    <section className={className}>
      <AccordionSection
        icon={<Clock className="w-5 h-5" />}
        title={t('recentlyViewed')}
        itemCount={items.length}
        defaultOpen={defaultOpen}
        showClear={true}
        clearLabel={t('clearHistory')}
        onClear={clearAll}
        iconColorClass="text-pink-500"
        bgClass="bg-gray-50"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {recentProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </AccordionSection>
    </section>
  );
}
