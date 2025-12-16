'use client';

import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
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
  mini?: boolean;
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

  useEffect(() => {
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
  }, [viewedItems, isViewedLoading, fetchRecommendations, fetchProducts]);

  // Don't render if no viewing history or still loading
  if (isViewedLoading || viewedItems.length < 2) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <AccordionSection
            icon={<Sparkles className="w-5 h-5" />}
            title={t.title}
            defaultOpen={false}
            iconColorClass={themeConfig.forYouRecommendations.iconColorClass}
            bgClass={themeConfig.forYouRecommendations.bgClass}
          >
            <ProductSkeleton count={8} />
          </AccordionSection>
        </div>
      </section>
    );
  }

  // No recommendations
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <AccordionSection
          icon={<Sparkles className="w-5 h-5" />}
          title={t.title}
          itemCount={products.length}
          defaultOpen={false}
          iconColorClass={themeConfig.forYouRecommendations.iconColorClass}
          bgClass={themeConfig.forYouRecommendations.bgClass}
        >
          <p className={`text-xs ${themeConfig.forYouRecommendations.subtitleClass} mb-3`}>{t.basedOn}</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {products.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-16 sm:w-20">
                <ProductCard product={product} mini />
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>
    </section>
  );
}
