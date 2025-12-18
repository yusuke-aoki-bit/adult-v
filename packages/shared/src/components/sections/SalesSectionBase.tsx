'use client';

import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Flame } from 'lucide-react';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { getThemeConfig, type SectionTheme } from './theme';
import { salesTranslations, getTranslation } from './translations';

// Generic product type that works with both apps
interface BaseProduct {
  id: string | number;
}

interface SaleProductMeta {
  productId: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

interface ProductCardProps<T extends BaseProduct> {
  product: T;
  compact?: boolean;
}

interface SalesSectionBaseProps<T extends BaseProduct> {
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme: SectionTheme;
  /** ProductCard component from the app */
  ProductCard: ComponentType<ProductCardProps<T>>;
  /** Sale products metadata from server */
  saleProducts: SaleProductMeta[];
  /** Custom fetch function for products */
  fetchProducts?: (ids: number[]) => Promise<T[]>;
  /** Function to merge sale info into product */
  mergeSaleInfo?: (product: T, sale: SaleProductMeta) => T;
}

/**
 * Shared SalesSection component
 * Displays products currently on sale
 */
export function SalesSectionBase<T extends BaseProduct>({
  theme,
  ProductCard,
  saleProducts,
  fetchProducts,
  mergeSaleInfo,
}: SalesSectionBaseProps<T>): ReactNode {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = getTranslation(salesTranslations, locale);
  const themeConfig = getThemeConfig(theme);

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

  // Fetch products (only when expanded)
  useEffect(() => {
    // 展開されていない場合はフェッチしない（パフォーマンス優先）
    if (!hasExpanded) return;

    const doFetch = async () => {
      if (saleProducts.length === 0) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      try {
        const ids = saleProducts.slice(0, 8).map(p => p.productId);

        let fetchedProducts: T[];
        if (fetchProducts) {
          fetchedProducts = await fetchProducts(ids);
        } else {
          const response = await fetch(`/api/products?ids=${ids.join(',')}`);
          if (!response.ok) {
            throw new Error('Failed to fetch products');
          }
          const data = await response.json();
          fetchedProducts = data.products;
        }

        // Maintain sale order and merge sale info
        const productMap = new Map<number, T>();
        for (const product of fetchedProducts) {
          productMap.set(Number(product.id), product);
        }

        const orderedProducts: T[] = [];
        for (const sale of saleProducts.slice(0, 8)) {
          const product = productMap.get(sale.productId);
          if (product) {
            // Merge sale info into product
            const mergedProduct = mergeSaleInfo
              ? mergeSaleInfo(product, sale)
              : {
                  ...product,
                  salePrice: sale.salePrice,
                  regularPrice: sale.regularPrice,
                  discount: sale.discountPercent,
                  saleEndAt: sale.endAt || undefined,
                };
            orderedProducts.push(mergedProduct as T);
          }
        }

        setProducts(orderedProducts);
      } catch (err) {
        console.error('Failed to fetch sale products:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    doFetch();
  }, [saleProducts, fetchProducts, mergeSaleInfo, hasExpanded]);

  if (saleProducts.length === 0) {
    return null;
  }

  // コンテンツの決定：未展開→空、ロード中→スケルトン、ロード完了→商品リスト
  const renderContent = () => {
    if (!hasExpanded) {
      // まだ展開されていない場合は空のプレースホルダー
      return <div className="h-24 flex items-center justify-center text-sm theme-text-muted">クリックして表示</div>;
    }

    if (isLoading) {
      return <ProductSkeleton count={Math.min(saleProducts.length, 8)} />;
    }

    return (
      <>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
        {/* View all sales link */}
        <Link
          href={`/${locale}/products?onSale=true`}
          className={`flex items-center justify-center gap-2 mt-4 py-2 ${themeConfig.salesSection.linkColorClass} transition-colors text-sm font-medium`}
        >
          {t.viewAll}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </>
    );
  };

  return (
    <AccordionSection
      icon={<Flame className="w-5 h-5" />}
      title={t.title}
      itemCount={saleProducts.length}
      defaultOpen={false}
      onToggle={handleToggle}
      iconColorClass={themeConfig.salesSection.iconColorClass}
      bgClass={themeConfig.salesSection.bgClass}
    >
      {renderContent()}
    </AccordionSection>
  );
}
