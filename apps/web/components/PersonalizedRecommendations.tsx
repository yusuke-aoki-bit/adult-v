'use client';

import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { useRecentlyViewed, RecentlyViewedItem } from '@/hooks/useRecentlyViewed';
import AccordionSection from './AccordionSection';
import ProductCard from './ProductCard';
import { Product } from '@/types/product';

interface PersonalizedRecommendationsProps {
  className?: string;
  /** デフォルトで開いた状態にするか */
  defaultOpen?: boolean;
}

/**
 * RecentlyViewedItem を Product 型に変換
 * 必須フィールドは最小限の値で埋める
 */
function convertToProduct(item: RecentlyViewedItem): Product {
  return {
    id: item.id,
    title: item.title,
    description: '',
    price: 0,
    category: 'all',
    imageUrl: item.imageUrl || '',
    affiliateUrl: '',
    provider: item.aspName as Product['provider'],
    providerLabel: item.aspName,
  };
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

  // 履歴がない場合は表示しない
  if (isLoading || items.length === 0) return null;

  const products = items.slice(0, 8).map(convertToProduct);

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
        iconColorClass="text-rose-500"
        bgClass="bg-gray-800/50"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </AccordionSection>
    </section>
  );
}
