'use client';

import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { Flame, Users } from 'lucide-react';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { getThemeConfig, type SectionTheme } from './theme';
import { salesTranslations, getTranslation } from './translations';

// Generic product type that works with both apps
interface BaseProduct {
  id: string | number;
  performers?: Array<{ id: string | number; name: string }>;
}

// Generic actress type that works with both apps
interface BaseActress {
  id: string | number;
  name: string;
}

interface SaleProductMeta {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
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
  size?: 'full' | 'compact' | 'mini';
}

interface ActressCardProps<A extends BaseActress> {
  actress: A;
  size?: 'full' | 'compact' | 'mini';
}

interface SalesSectionBaseProps<T extends BaseProduct, A extends BaseActress = BaseActress> {
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme: SectionTheme;
  /** Locale for translations */
  locale?: string;
  /** ProductCard component from the app */
  ProductCard: ComponentType<ProductCardProps<T>>;
  /** ActressCard component from the app (optional) */
  ActressCard?: ComponentType<ActressCardProps<A>>;
  /** Sale products metadata from server */
  saleProducts: SaleProductMeta[];
  /** Custom fetch function for products */
  fetchProducts?: (ids: number[]) => Promise<T[]>;
  /** Function to merge sale info into product */
  mergeSaleInfo?: (product: T, sale: SaleProductMeta) => T;
  /** Custom fetch function for actresses */
  fetchActresses?: (ids: (string | number)[]) => Promise<A[]>;
  /** Function to convert performer to actress type */
  toActressType?: (performer: { id: string | number; name: string }) => A;
  /** Whether to expand by default (useful for mobile) */
  defaultOpen?: boolean;
}

/**
 * Shared SalesSection component
 * Displays products currently on sale
 */
export function SalesSectionBase<T extends BaseProduct, A extends BaseActress = BaseActress>({
  theme,
  locale: propLocale,
  ProductCard,
  ActressCard,
  saleProducts,
  fetchProducts,
  mergeSaleInfo,
  fetchActresses,
  toActressType,
  defaultOpen = false,
}: SalesSectionBaseProps<T, A>): ReactNode {
  // Use prop locale if provided, otherwise default to 'ja'
  const locale = propLocale || 'ja';
  const t = getTranslation(salesTranslations, locale);
  const themeConfig = getThemeConfig(theme);

  const [products, setProducts] = useState<T[]>([]);
  const [actresses, setActresses] = useState<A[]>([]);
  const [isLoading, setIsLoading] = useState(defaultOpen);
  const [isActressLoading, setIsActressLoading] = useState(false);
  // 遅延フェッチ用: 一度でも展開されたかどうか
  const [hasExpanded, setHasExpanded] = useState(defaultOpen);

  // 展開時にフェッチをトリガー
  const handleToggle = useCallback((isOpen: boolean) => {
    if (isOpen && !hasExpanded) {
      setIsLoading(true);
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
        setActresses([]);
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

        // 女優データは商品表示後に非同期で取得（遅延読み込み）
        // これにより商品が先に表示され、体感速度が向上
        if (ActressCard && (fetchActresses || toActressType)) {
          // 非同期で女優データを取得（awaitしない）
          (async () => {
            setIsActressLoading(true);
            try {
              const performerMap = new Map<number, { id: number; name: string }>();
              for (const sale of saleProducts.slice(0, 8)) {
                if (sale.performers) {
                  for (const performer of sale.performers) {
                    if (!performerMap.has(performer.id)) {
                      performerMap.set(performer.id, performer);
                    }
                  }
                }
              }

              const uniquePerformers = Array.from(performerMap.values()).slice(0, 6);

              if (uniquePerformers.length > 0) {
                if (fetchActresses) {
                  const actressIds = uniquePerformers.map(p => p.id);
                  const fetchedActresses = await fetchActresses(actressIds);
                  setActresses(fetchedActresses);
                } else if (toActressType) {
                  const convertedActresses = uniquePerformers.map(p => toActressType(p));
                  setActresses(convertedActresses);
                }
              } else {
                setActresses([]);
              }
            } catch (err) {
              console.error('Failed to fetch actresses:', err);
              setActresses([]);
            } finally {
              setIsActressLoading(false);
            }
          })();
        }
      } catch (err) {
        console.error('Failed to fetch sale products:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    doFetch();
  }, [saleProducts, fetchProducts, mergeSaleInfo, fetchActresses, toActressType, ActressCard, hasExpanded]);

  if (saleProducts.length === 0) {
    return null;
  }

  // 展開後かつロード完了後に実際の商品数が0の場合は非表示
  if (hasExpanded && !isLoading && products.length === 0) {
    return null;
  }

  // コンテンツの決定：未展開/ロード中→スケルトン、ロード完了→商品リスト
  const renderContent = () => {
    // 未展開またはロード中はスケルトンを表示（高さを一定に保つ）
    if (!hasExpanded || isLoading) {
      return <ProductSkeleton count={Math.min(saleProducts.length, 8)} size="mini" />;
    }

    return (
      <div className="space-y-4">
        {/* 共演者セクション（遅延読み込み） */}
        {ActressCard && (isActressLoading || actresses.length > 0) && (
          <div>
            <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${theme === 'dark' ? 'text-rose-400' : 'text-rose-600'}`}>
              <Users className="w-3.5 h-3.5" />
              セール中の女優
              {isActressLoading && <span className="text-[10px] theme-text-muted animate-pulse">読み込み中...</span>}
            </h4>
            {isActressLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="theme-skeleton-card rounded-lg animate-pulse overflow-hidden">
                    <div className="aspect-square theme-skeleton-image" />
                    <div className="p-1.5"><div className="h-2.5 theme-skeleton-image rounded w-3/4" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {actresses.map((actress) => (
                  <ActressCard key={actress.id} actress={actress} size="mini" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 作品セクション */}
        <div>
          {ActressCard && actresses.length > 0 && (
            <h4 className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              セール作品
            </h4>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} size="mini" />
            ))}
          </div>
        </div>

        {/* View all sales link */}
        <Link
          href={`/${locale}/products?onSale=true`}
          className={`flex items-center justify-center gap-2 mt-2 py-2 ${themeConfig.salesSection.linkColorClass} transition-colors text-sm font-medium`}
        >
          {t.viewAll}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  };

  // 展開後は実際に取得できた商品数を表示、未展開時はカウントを表示しない
  const displayCount = hasExpanded && !isLoading ? products.length : undefined;

  return (
    <AccordionSection
      icon={<Flame className="w-5 h-5" />}
      title={t.title}
      itemCount={displayCount}
      defaultOpen={defaultOpen}
      onToggle={handleToggle}
      iconColorClass={themeConfig.salesSection.iconColorClass}
      bgClass={themeConfig.salesSection.bgClass}
    >
      {renderContent()}
    </AccordionSection>
  );
}
