'use client';

import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from 'react';
import { Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { getThemeConfig, type SectionTheme } from './theme';
import { forYouTranslations, getTranslation } from './translations';

// Generic product type that works with both apps
interface BaseProduct {
  id: string | number;
}

interface RecentlyViewedItem {
  id: string;
  viewedAt: number;
}

interface UseRecentlyViewedReturn {
  items: RecentlyViewedItem[];
  isLoading: boolean;
}

interface ProductCardProps<T extends BaseProduct> {
  product: T;
  compact?: boolean;
}

interface RecommendationMeta {
  id: number;
  matchType: 'favorite_performer' | 'favorite_tag';
  matchScore: number;
}

interface ForYouRecommendationsSectionProps<T extends BaseProduct> {
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme: SectionTheme;
  /** ProductCard component from the app */
  ProductCard: ComponentType<ProductCardProps<T>>;
  /** useRecentlyViewed hook from the app */
  useRecentlyViewed: () => UseRecentlyViewedReturn;
  /** Custom fetch function for recommendations */
  fetchRecommendations?: (productIds: string[]) => Promise<RecommendationMeta[]>;
  /** Custom fetch function for products */
  fetchProducts?: (ids: number[]) => Promise<T[]>;
}

/**
 * Shared ForYouRecommendations section component
 * Displays personalized product recommendations based on viewing history
 */
export function ForYouRecommendationsSection<T extends BaseProduct>({
  theme,
  ProductCard,
  useRecentlyViewed,
  fetchRecommendations,
  fetchProducts,
}: ForYouRecommendationsSectionProps<T>): ReactNode {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = getTranslation(forYouTranslations, locale);
  const themeConfig = getThemeConfig(theme);

  const { items: viewedItems, isLoading: isViewedLoading } = useRecentlyViewed();

  const [products, setProducts] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 遅延フェッチ用: 一度でも展開されたかどうか
  const [hasExpanded, setHasExpanded] = useState(false);

  // 展開時にフェッチをトリガー
  const handleToggle = useCallback((isOpen: boolean) => {
    if (isOpen && !hasExpanded) {
      setHasExpanded(true);
    }
  }, [hasExpanded]);

  // Fetch recommendations (only when expanded)
  useEffect(() => {
    // 展開されていない場合はフェッチしない（パフォーマンス優先）
    if (!hasExpanded) return;

    const doFetch = async () => {
      if (viewedItems.length < 2) {
        setProducts([]);
        return;
      }

      setIsLoading(true);

      try {
        // Step 1: Get recommendation IDs
        const productIds = viewedItems.slice(0, 10).map(item => item.id);

        let recommendations: RecommendationMeta[];
        if (fetchRecommendations) {
          recommendations = await fetchRecommendations(productIds);
        } else {
          const recResponse = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds, limit: 8 }),
          });

          if (!recResponse.ok) {
            throw new Error('Failed to fetch recommendations');
          }

          const recData = await recResponse.json();
          recommendations = recData.recommendations || [];
        }

        if (recommendations.length === 0) {
          setProducts([]);
          return;
        }

        // Step 2: Get full product info from IDs
        const ids = recommendations.map(r => r.id);

        let fetchedProducts: T[];
        if (fetchProducts) {
          fetchedProducts = await fetchProducts(ids);
        } else {
          const productsResponse = await fetch(`/api/products?ids=${ids.join(',')}`);
          if (!productsResponse.ok) {
            throw new Error('Failed to fetch product details');
          }
          const productsData = await productsResponse.json();
          fetchedProducts = productsData.products;
        }

        // Maintain recommendation order
        const productMap = new Map<number, T>();
        for (const product of fetchedProducts) {
          productMap.set(Number(product.id), product);
        }

        const orderedProducts: T[] = [];
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
      doFetch();
    }
  }, [viewedItems, isViewedLoading, fetchRecommendations, fetchProducts, hasExpanded]);

  // Don't render if no viewing history or still loading
  if (isViewedLoading || viewedItems.length < 2) {
    return null;
  }

  // コンテンツの決定：未展開→空、ロード中→スケルトン、ロード完了→商品リスト
  const renderContent = () => {
    if (!hasExpanded) {
      // まだ展開されていない場合は空のプレースホルダー
      return <div className="h-24 flex items-center justify-center text-sm theme-text-muted">クリックして表示</div>;
    }

    if (isLoading) {
      return <ProductSkeleton count={8} />;
    }

    if (products.length === 0) {
      return <div className="h-24 flex items-center justify-center text-sm theme-text-muted">おすすめが見つかりませんでした</div>;
    }

    return (
      <>
        <p className={`text-xs ${themeConfig.forYouRecommendations.subtitleClass} mb-3`}>{t.basedOn}</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {products.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} compact />
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <AccordionSection
          icon={<Sparkles className="w-5 h-5" />}
          title={t.title}
          itemCount={hasExpanded && products.length > 0 ? products.length : undefined}
          defaultOpen={false}
          onToggle={handleToggle}
          iconColorClass={themeConfig.forYouRecommendations.iconColorClass}
          bgClass={themeConfig.forYouRecommendations.bgClass}
        >
          {renderContent()}
        </AccordionSection>
      </div>
    </section>
  );
}
