'use client';

import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import { Clock, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { getThemeConfig, type SectionTheme } from './theme';
import { recentlyViewedTranslations, getTranslation } from './translations';

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
  removeItem: (id: string) => void;
  clearAll: () => void;
}

interface ProductCardProps<T extends BaseProduct> {
  product: T;
  compact?: boolean;
  mini?: boolean;
}

interface RecentlyViewedSectionProps<T extends BaseProduct> {
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme: SectionTheme;
  /** ProductCard component from the app */
  ProductCard: ComponentType<ProductCardProps<T>>;
  /** useRecentlyViewed hook from the app */
  useRecentlyViewed: () => UseRecentlyViewedReturn;
  /** Custom fetch function for products, defaults to /api/products?ids=... */
  fetchProducts?: (ids: string[]) => Promise<T[]>;
}

/**
 * Shared RecentlyViewed section component
 * Displays products the user has recently viewed with delete functionality
 */
export function RecentlyViewedSection<T extends BaseProduct>({
  theme,
  ProductCard,
  useRecentlyViewed,
  fetchProducts,
}: RecentlyViewedSectionProps<T>): ReactNode {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = getTranslation(recentlyViewedTranslations, locale);
  const themeConfig = getThemeConfig(theme);

  const { items, isLoading: isViewedLoading, removeItem, clearAll } = useRecentlyViewed();

  const [products, setProducts] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch full product info from ID list
  useEffect(() => {
    const doFetch = async () => {
      if (items.length === 0) {
        setProducts([]);
        return;
      }

      setIsLoading(true);
      try {
        const ids = items.slice(0, 8).map(item => item.id);

        let fetchedProducts: T[];
        if (fetchProducts) {
          fetchedProducts = await fetchProducts(ids);
        } else {
          // Default fetch implementation
          const response = await fetch(`/api/products?ids=${ids.join(',')}`);
          if (!response.ok) {
            throw new Error('Failed to fetch products');
          }
          const data = await response.json();
          fetchedProducts = data.products;
        }

        // Maintain viewing order
        const productMap = new Map<string, T>();
        for (const product of fetchedProducts) {
          productMap.set(String(product.id), product);
        }

        const orderedProducts: T[] = [];
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
      doFetch();
    }
  }, [items, isViewedLoading, fetchProducts]);

  // Don't render if loading or no history
  if (isViewedLoading || items.length === 0) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <AccordionSection
            icon={<Clock className="w-5 h-5" />}
            title={t.title}
            itemCount={items.length}
            defaultOpen={false}
            iconColorClass={themeConfig.recentlyViewed.iconColorClass}
            bgClass={themeConfig.recentlyViewed.bgClass}
          >
            <ProductSkeleton count={Math.min(items.length, 8)} />
          </AccordionSection>
        </div>
      </section>
    );
  }

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <AccordionSection
          icon={<Clock className="w-5 h-5" />}
          title={t.title}
          itemCount={items.length}
          defaultOpen={false}
          showClear={true}
          clearLabel={t.clearAll}
          onClear={clearAll}
          iconColorClass={themeConfig.recentlyViewed.iconColorClass}
          bgClass={themeConfig.recentlyViewed.bgClass}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {products.map((product) => (
              <div key={product.id} className="relative group/card flex-shrink-0 w-16 sm:w-20">
                <ProductCard product={product} mini />
                {/* Delete button - shows on card hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeItem(String(product.id));
                  }}
                  className={`absolute -top-1 -right-1 z-30 w-5 h-5 ${themeConfig.recentlyViewed.deleteButtonBgClass} hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg`}
                  aria-label={t.removeFromHistory}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>
    </section>
  );
}
