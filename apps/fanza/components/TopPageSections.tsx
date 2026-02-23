'use client';

import { useState, useEffect, useCallback } from 'react';
import { Film, Tag, Sparkles, TrendingUp, BarChart3, AlertTriangle, Clock, Newspaper, Star } from 'lucide-react';
import { TopPageMenuSection, ProductCardBase, ActressCardBase, HomeSectionManager } from '@adult-v/shared/components';
import { localizedHref } from '@adult-v/shared/i18n';
import { useRecentlyViewed, useHomeSections } from '@adult-v/shared/hooks';

interface SaleProduct {
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

interface TopPageSectionsProps {
  locale: string;
  saleProducts: SaleProduct[];
  uncategorizedCount: number;
  isTopPage: boolean;
  isFanzaSite?: boolean;
  translations: {
    viewProductList: string;
    viewProductListDesc: string;
    uncategorizedBadge: string;
    uncategorizedDescription: string;
    uncategorizedCount: string;
  };
}

// 共通のグリッドスタイル
const GRID_CLASSES = 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2';
const SKELETON_CLASSES = 'animate-pulse bg-gray-200 rounded-lg aspect-[2/3]';

const sectionTexts = {
  ja: {
    noHistory: '閲覧履歴がありません',
    recentActresses: '最近見た女優',
    recentProducts: '最近見た作品',
    saleActresses: 'セール中の女優',
    saleProducts: 'セール中の作品',
    recommendationHint: '閲覧履歴に基づいたおすすめを表示します',
  },
  en: {
    noHistory: 'No viewing history',
    recentActresses: 'Recent actresses',
    recentProducts: 'Recent products',
    saleActresses: 'Actresses on sale',
    saleProducts: 'Products on sale',
    recommendationHint: 'Showing recommendations based on your history',
  },
} as const;
function getSectionText(locale: string) {
  return sectionTexts[locale as keyof typeof sectionTexts] || sectionTexts.ja;
}

// 最近見た作品コンテンツ
function RecentlyViewedContent({ locale }: { locale: string }) {
  const { items: recentlyViewed, isLoading: historyLoading } = useRecentlyViewed();
  const [products, setProducts] = useState<
    Array<{
      id: number;
      title: string;
      imageUrl: string | null;
      performers?: Array<{ id: number; name: string }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (historyLoading || recentlyViewed.length === 0 || hasFetched) return;

    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const ids = recentlyViewed.slice(0, 8).map((item) => item.id);
        const response = await fetch(`/api/products?ids=${ids.join(',')}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          const productList = Array.isArray(data.products) ? data.products : [];
          // 閲覧順を維持
          const productMap = new Map(productList.map((p: { id: number }) => [String(p.id), p]));
          const ordered = ids.map((id) => productMap.get(id)).filter(Boolean);
          setProducts(ordered as typeof products);
        }
      } catch (error) {
        console.error('Failed to fetch recently viewed products:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasFetched(true);
        }
      }
    };
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [historyLoading, recentlyViewed, hasFetched]);

  if (historyLoading || recentlyViewed.length === 0) {
    return <p className="text-sm text-gray-500">{getSectionText(locale).noHistory}</p>;
  }

  if (loading) {
    return (
      <div className={GRID_CLASSES}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className={SKELETON_CLASSES} />
        ))}
      </div>
    );
  }

  // 女優を抽出（重複排除）
  const actressMap = new Map<number, { id: number; name: string }>();
  products.forEach((product) => {
    product.performers?.forEach((performer) => {
      if (!actressMap.has(performer.id)) {
        actressMap.set(performer.id, performer);
      }
    });
  });
  const actresses = Array.from(actressMap.values()).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 女優 */}
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-pink-500">{getSectionText(locale).recentActresses}</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-500">{getSectionText(locale).recentProducts}</h4>
        <div className={GRID_CLASSES}>
          {products.map((product) => (
            <ProductCardBase
              key={product.id}
              product={{
                id: String(product.id),
                title: product.title,
                imageUrl: product.imageUrl ?? undefined,
                price: 0,
              }}
              size="mini"
              theme="light"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// セール商品コンテンツ
function SaleProductsContent({ products, locale }: { products: SaleProduct[]; locale: string }) {
  if (products.length === 0) return null;

  // 女優を抽出（重複排除）
  const actressMap = new Map<number, { id: number; name: string }>();
  products.forEach((product) => {
    product.performers?.forEach((performer) => {
      if (!actressMap.has(performer.id)) {
        actressMap.set(performer.id, performer);
      }
    });
  });
  const actresses = Array.from(actressMap.values()).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 女優 */}
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-red-500">{getSectionText(locale).saleActresses}</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-500">{getSectionText(locale).saleProducts}</h4>
        <div className={GRID_CLASSES}>
          {products.slice(0, 8).map((product) => (
            <div key={product.productId} className="relative">
              <ProductCardBase
                product={{
                  id: String(product.productId),
                  title: product.title,
                  imageUrl: product.thumbnailUrl ?? undefined,
                  price: product.salePrice,
                }}
                size="mini"
                theme="light"
              />
              {/* 割引バッジ */}
              <div className="absolute top-1 left-1 z-10 rounded bg-red-600 px-1 py-0.5 text-[10px] font-bold text-white">
                -{product.discountPercent}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// あなたへのおすすめコンテンツ
function RecommendationsContent({ locale }: { locale: string }) {
  const { items: recentlyViewed, isLoading: historyLoading } = useRecentlyViewed();
  const [products, setProducts] = useState<
    Array<{
      id: number;
      title: string;
      imageUrl: string | null;
      releaseDate: string | null;
    }>
  >([]);
  const [actresses, setActresses] = useState<
    Array<{
      id: number;
      name: string;
      thumbnailUrl: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (hasFetched || recentlyViewed.length < 3) return;

    setLoading(true);
    try {
      // POSTリクエストでhistoryをbodyに含める
      const response = await fetch(`/api/recommendations/from-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: recentlyViewed.slice(0, 10).map((item) => ({
            id: item.id,
            title: item.title,
          })),
          limit: 8,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.recommendations || []);
        // 女優データも取得
        if (data.userProfile?.topPerformers) {
          setActresses(data.userProfile.topPerformers.slice(0, 6));
        }
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [hasFetched, recentlyViewed]);

  useEffect(() => {
    if (!historyLoading && recentlyViewed.length >= 1) {
      fetchRecommendations();
    }
  }, [historyLoading, recentlyViewed.length, fetchRecommendations]);

  if (historyLoading || recentlyViewed.length < 1) {
    return <p className="text-sm text-gray-500">{getSectionText(locale).recommendationHint}</p>;
  }

  if (loading) {
    return (
      <div className={GRID_CLASSES}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className={SKELETON_CLASSES} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 女優 */}
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-purple-500">おすすめ女優</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                  thumbnail: actress.thumbnailUrl ?? undefined,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      {products.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-gray-500">おすすめ作品</h4>
          <div className={GRID_CLASSES}>
            {products.map((product) => (
              <ProductCardBase
                key={product.id}
                product={{
                  id: String(product.id),
                  title: product.title,
                  imageUrl: product.imageUrl ?? undefined,
                  releaseDate: product.releaseDate ?? undefined,
                  price: 0,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 今週の注目コンテンツ
function WeeklyHighlightsContent({ locale: _locale }: { locale: string }) {
  const [actresses, setActresses] = useState<
    Array<{
      id: number;
      name: string;
      thumbnailUrl: string | null;
    }>
  >([]);
  const [products, setProducts] = useState<
    Array<{
      id: number;
      title: string;
      imageUrl: string | null;
      releaseDate: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const response = await fetch('/api/weekly-highlights');
        if (response.ok) {
          const data = await response.json();
          setActresses(data.trendingActresses?.slice(0, 6) || []);
          setProducts([...(data.hotNewReleases?.slice(0, 4) || []), ...(data.rediscoveredClassics?.slice(0, 4) || [])]);
        }
      } catch (error) {
        console.error('Failed to fetch weekly highlights:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHighlights();
  }, []);

  if (loading) {
    return (
      <div className={GRID_CLASSES}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className={SKELETON_CLASSES} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 女優 */}
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-amber-500">注目の女優</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                  thumbnail: actress.thumbnailUrl ?? undefined,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      {products.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-gray-500">注目の作品</h4>
          <div className={GRID_CLASSES}>
            {products.map((product) => (
              <ProductCardBase
                key={product.id}
                product={{
                  id: String(product.id),
                  title: product.title,
                  imageUrl: product.imageUrl ?? undefined,
                  releaseDate: product.releaseDate ?? undefined,
                  price: 0,
                }}
                size="mini"
                theme="light"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// トレンド分析コンテンツ
function TrendingContent({ locale }: { locale: string }) {
  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);
  const [performers, setPerformers] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const response = await fetch(`/api/trends?period=week&locale=${locale}`);
        if (response.ok) {
          const data = await response.json();
          setTags(data.tags?.slice(0, 5) || []);
          setPerformers(data.performers?.slice(0, 5) || []);
        }
      } catch (error) {
        console.error('Failed to fetch trends:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [locale]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* ジャンル */}
      {tags.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-pink-500">人気ジャンル</h4>
          <div className="space-y-1">
            {tags.map((tag, index) => (
              <div
                key={tag.name}
                className="flex cursor-pointer items-center gap-2 rounded bg-gray-50 p-2 transition-colors hover:bg-gray-100"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    index < 3 ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-gray-900">{tag.name}</span>
                <span className="text-xs text-gray-500">{tag.count}作品</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 女優 */}
      {performers.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-pink-500">人気女優</h4>
          <div className="space-y-1">
            {performers.map((performer, index) => (
              <div
                key={performer.name}
                className="flex cursor-pointer items-center gap-2 rounded bg-gray-50 p-2 transition-colors hover:bg-gray-100"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    index < 3 ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-gray-900">{performer.name}</span>
                <span className="text-xs text-gray-500">{performer.count}作品</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * トップページ上部のセクション群（女優一覧の前）
 * - セール中
 * - 最近見た作品
 */
export function TopPageUpperSections({
  locale,
  saleProducts,
  pageId = 'home',
}: {
  locale: string;
  saleProducts: SaleProduct[];
  pageId?: string;
}) {
  const { isSectionVisible } = useHomeSections({ locale, pageId });

  return (
    <div className="space-y-3">
      {/* セール情報 */}
      {isSectionVisible('sale') && saleProducts.length > 0 && (
        <div id="sale" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Tag className="h-5 w-5" />}
            title="セール中"
            subtitle="お得な割引商品をチェック"
            theme="light"
            defaultOpen={false}
          >
            <SaleProductsContent products={saleProducts} locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* 最近見た作品 */}
      {isSectionVisible('recently-viewed') && (
        <div id="recently-viewed" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Clock className="h-5 w-5" />}
            title="最近見た作品"
            subtitle="閲覧履歴から"
            theme="light"
            defaultOpen={false}
          >
            <RecentlyViewedContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}
    </div>
  );
}

// カテゴリバッジのスタイル
const NEWS_CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new_releases: { bg: 'bg-blue-100 text-blue-800', text: '', label: '新着' },
  sales: { bg: 'bg-red-100 text-red-800', text: '', label: 'セール' },
  ai_analysis: { bg: 'bg-purple-100 text-purple-800', text: '', label: '分析' },
  industry: { bg: 'bg-green-100 text-green-800', text: '', label: '業界' },
  site_update: { bg: 'bg-gray-100 text-gray-800', text: '', label: 'お知らせ' },
};

/** Strip stale/hallucinated dates from AI-generated titles */
function sanitizeNewsTitle(title: string): string {
  const now = new Date();
  const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  let s = title.replace(/[〇○]月[〇○]日/g, todayStr);
  s = s.replace(/[（(]20\d{2}[/／]\d{1,2}[/／]\d{1,2}[)）]/g, '');
  s = s.replace(/【20\d{2}[/／]\d{1,2}[/／]\d{1,2}】/g, `【${todayStr}】`);
  s = s.replace(/【[〇○]月[〇○]日】/g, `【${todayStr}】`);
  return s.trim();
}

// ニュースコンテンツ
function NewsContent({ locale: _locale }: { locale: string }) {
  const [articles, setArticles] = useState<
    Array<{
      id: number;
      slug: string;
      category: string;
      title: string;
      excerpt: string | null;
      featured: boolean;
      published_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/news?mode=latest&limit=5');
        if (response.ok) {
          const data = await response.json();
          setArticles(data.articles || []);
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <p className="text-sm text-gray-500">ニュースはまだありません</p>;
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const style = (NEWS_CATEGORY_STYLES[article.category] || NEWS_CATEGORY_STYLES['site_update'])!;
        const publishedDate = new Date(article.published_at).toLocaleDateString('ja-JP', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <div
            key={article.id}
            className={`block rounded-lg p-3 ${
              article.featured ? 'border border-yellow-200 bg-yellow-50' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${style.bg}`}>{style.label}</span>
                  <span className="text-xs text-gray-400">{publishedDate}</span>
                  {article.featured && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                </div>
                <h4 className="line-clamp-1 text-sm font-medium text-gray-900">{sanitizeNewsTitle(article.title)}</h4>
                {article.excerpt && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{article.excerpt}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * トップページ下部のセクション群（女優一覧の後）
 * - あなたへのおすすめ
 * - 今週の注目
 * - トレンド分析
 * - 商品一覧リンク
 * - 未整理作品
 */
export function TopPageLowerSections({
  locale,
  uncategorizedCount,
  isTopPage,
  isFanzaSite = true,
  translations: t,
  pageId = 'home',
}: Omit<TopPageSectionsProps, 'saleProducts'> & { pageId?: string }) {
  // isFanzaSiteは将来的な拡張用（FANZA版では常にtrue）
  void isFanzaSite;
  const { isSectionVisible } = useHomeSections({ locale, pageId });

  return (
    <div className="space-y-3">
      {/* あなたへのおすすめ */}
      {isSectionVisible('recommendations') && (
        <div id="recommendations" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Sparkles className="h-5 w-5" />}
            title="あなたへのおすすめ"
            subtitle="閲覧履歴に基づくレコメンド"
            theme="light"
            defaultOpen={false}
          >
            <RecommendationsContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* 今週の注目 */}
      {isSectionVisible('weekly-highlights') && (
        <div id="weekly-highlights" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<TrendingUp className="h-5 w-5" />}
            title="今週の注目"
            subtitle="話題の女優と作品"
            theme="light"
            defaultOpen={false}
          >
            <WeeklyHighlightsContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* ニュース */}
      {isSectionVisible('news') && (
        <div id="news" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Newspaper className="h-5 w-5" />}
            title="ニュース"
            subtitle="最新情報・セール・トレンド"
            theme="light"
            defaultOpen={false}
          >
            <NewsContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* トレンド分析 */}
      {isSectionVisible('trending') && isTopPage && (
        <div id="trending" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<BarChart3 className="h-5 w-5" />}
            title="トレンド分析"
            subtitle="人気ジャンル・女優ランキング"
            theme="light"
            defaultOpen={false}
          >
            <TrendingContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* 分割線 */}
      <div className="my-2 border-t border-gray-200" />

      {/* 商品一覧へのリンク */}
      {isSectionVisible('all-products') && (
        <div id="all-products" className="scroll-mt-20">
          <TopPageMenuSection
            type="link"
            href={localizedHref('/products', locale)}
            icon={<Film className="h-5 w-5" />}
            title={t.viewProductList}
            subtitle={t.viewProductListDesc}
            theme="light"
          />
        </div>
      )}

      {/* 未整理作品へのリンク */}
      {isSectionVisible('uncategorized') && uncategorizedCount > 0 && (
        <TopPageMenuSection
          type="link"
          href={localizedHref('/products?uncategorized=true', locale)}
          icon={<AlertTriangle className="h-5 w-5" />}
          title={t.uncategorizedDescription}
          badge={t.uncategorizedCount}
          theme="light"
        />
      )}

      {/* ホームセクション管理（トップページのみ） */}
      {isTopPage && <HomeSectionManager locale={locale} theme="light" pageId={pageId} />}
    </div>
  );
}

/**
 * トップページのセクション群（後方互換性のため維持）
 * 統一されたメニュースタイルで表示
 * @deprecated TopPageUpperSections と TopPageLowerSections を使用してください
 */
export default function TopPageSections({
  locale,
  saleProducts,
  uncategorizedCount,
  isTopPage,
  translations: t,
}: TopPageSectionsProps) {
  return (
    <div className="space-y-6">
      <TopPageUpperSections locale={locale} saleProducts={saleProducts} />
      <TopPageLowerSections
        locale={locale}
        uncategorizedCount={uncategorizedCount}
        isTopPage={isTopPage}
        translations={t}
      />
    </div>
  );
}
