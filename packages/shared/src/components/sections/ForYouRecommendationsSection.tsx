'use client';

import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from 'react';
import { Sparkles, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import AccordionSection from '../AccordionSection';
import ProductSkeleton from '../ProductSkeleton';
import { getThemeConfig, type SectionTheme } from './theme';
import { forYouTranslations, getTranslation } from './translations';

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

interface ActressCardProps<A extends BaseActress> {
  actress: A;
  compact?: boolean;
}

interface RecommendationMeta {
  id: number;
  matchType: 'favorite_performer' | 'favorite_tag';
  matchScore: number;
}

interface ForYouRecommendationsSectionProps<T extends BaseProduct, A extends BaseActress = BaseActress> {
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme: SectionTheme;
  /** ProductCard component from the app */
  ProductCard: ComponentType<ProductCardProps<T>>;
  /** ActressCard component from the app (optional) */
  ActressCard?: ComponentType<ActressCardProps<A>>;
  /** useRecentlyViewed hook from the app */
  useRecentlyViewed: () => UseRecentlyViewedReturn;
  /** Custom fetch function for recommendations */
  fetchRecommendations?: (productIds: string[]) => Promise<RecommendationMeta[]>;
  /** Custom fetch function for products */
  fetchProducts?: (ids: number[]) => Promise<T[]>;
  /** Custom fetch function for actresses */
  fetchActresses?: (ids: (string | number)[]) => Promise<A[]>;
  /** Function to convert performer to actress type */
  toActressType?: (performer: { id: string | number; name: string }) => A;
}

/**
 * Shared ForYouRecommendations section component
 * Displays personalized product recommendations based on viewing history
 */
export function ForYouRecommendationsSection<T extends BaseProduct, A extends BaseActress = BaseActress>({
  theme,
  ProductCard,
  ActressCard,
  useRecentlyViewed,
  fetchRecommendations,
  fetchProducts,
  fetchActresses,
  toActressType,
}: ForYouRecommendationsSectionProps<T, A>): ReactNode {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = getTranslation(forYouTranslations, locale);
  const themeConfig = getThemeConfig(theme);

  const { items: viewedItems, isLoading: isViewedLoading } = useRecentlyViewed();

  const [products, setProducts] = useState<T[]>([]);
  const [actresses, setActresses] = useState<A[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActressLoading, setIsActressLoading] = useState(false);
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
        setActresses([]);
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
          setActresses([]);
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

        // 女優データは商品表示後に非同期で取得（遅延読み込み）
        // これにより商品が先に表示され、体感速度が向上
        if (ActressCard && (fetchActresses || toActressType)) {
          // 非同期で女優データを取得（awaitしない）
          (async () => {
            setIsActressLoading(true);
            try {
              const performerMap = new Map<string | number, { id: string | number; name: string }>();
              for (const product of orderedProducts) {
                if (product.performers) {
                  for (const performer of product.performers) {
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
        console.error('Failed to fetch recommendations:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isViewedLoading) {
      doFetch();
    }
  }, [viewedItems, isViewedLoading, fetchRecommendations, fetchProducts, fetchActresses, toActressType, ActressCard, hasExpanded]);

  // Don't render if no viewing history or still loading
  if (isViewedLoading || viewedItems.length < 2) {
    return null;
  }

  // Don't render if expanded but no products (e.g., all items are FANZA-only on web)
  if (hasExpanded && !isLoading && products.length === 0) {
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

    return (
      <div className="space-y-4">
        <p className={`text-xs ${themeConfig.forYouRecommendations.subtitleClass}`}>{t.basedOn}</p>

        {/* 共演者セクション（遅延読み込み） */}
        {ActressCard && (isActressLoading || actresses.length > 0) && (
          <div>
            <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${theme === 'dark' ? 'text-rose-400' : 'text-rose-600'}`}>
              <Users className="w-3.5 h-3.5" />
              おすすめ女優
              {isActressLoading && <span className="text-[10px] theme-text-muted animate-pulse">読み込み中...</span>}
            </h4>
            {isActressLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-700/50 rounded-lg animate-pulse" style={{ aspectRatio: '3/4' }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {actresses.map((actress) => (
                  <ActressCard key={actress.id} actress={actress} compact />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 作品セクション */}
        <div>
          {ActressCard && actresses.length > 0 && (
            <h4 className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              おすすめ作品
            </h4>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {products.map((product) => (
              <div key={product.id}>
                <ProductCard product={product} compact />
              </div>
            ))}
          </div>
        </div>
      </div>
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
