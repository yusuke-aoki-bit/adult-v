'use client';

import { useState, useEffect, useCallback } from 'react';
import { Film, Tag, Sparkles, TrendingUp, BarChart3, AlertTriangle, Clock, ExternalLink, Star, Users, Gem, Vote, List, Search, Cake, Trophy, Play, Newspaper } from 'lucide-react';
import Link from 'next/link';
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
  performers: Array<{ id: number; name: string; profileImageUrl?: string | null }>;
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
const GRID_CLASSES = 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3';
const SKELETON_CLASSES = 'animate-pulse bg-gray-700 rounded-lg aspect-[2/3]';

const sectionTexts = {
  ja: {
    noHistory: '閲覧履歴がありません', recentActresses: '最近見た女優', recentProducts: '最近見た作品',
    moreRecommendations: 'もっとおすすめを見る', moreNewReleases: '新作をもっと見る',
    allGenres: '全ジャンルを見る', allActresses: '女優一覧を見る', allNews: 'ニュース一覧を見る',
    saleSubtitle: '今だけお得！見逃し厳禁', recentlyViewed: '最近見た作品', recentlyViewedSub: '閲覧履歴から',
    recommendations: 'あなたへのおすすめ', recommendationsSub: '閲覧履歴に基づくレコメンド',
    weeklyHighlights: '今週の注目', weeklyHighlightsSub: '話題の女優と作品',
    news: 'ニュース', newsSub: '最新情報・セール・トレンド',
    trending: 'トレンド分析', trendingSub: '人気ジャンル・女優ランキング',
    fanzaSite: 'FANZA専門サイト', fanzaSiteSub: 'FANZA作品に特化した姉妹サイト',
    // sub-component labels
    saleActresses: 'セール中の女優', saleProducts: 'セール中の作品',
    recommendHint: '閲覧履歴に基づいたおすすめを表示します',
    recommendedActresses: 'おすすめ女優', recommendedProducts: 'おすすめ作品',
    featuredActresses: '注目の女優', featuredProducts: '注目の作品',
    popularGenres: '人気ジャンル', popularActresses: '人気女優',
    productsCount: (n: number) => `${n}作品`,
    noNews: 'ニュースはまだありません',
    saleTitle: (count: number) => `🔥 セール中 ${count}件`,
    saleCta: '🔥 セール中の全商品を見る',
    saleCtaSub: (count: number) => `${count}件以上のお得な作品をチェック →`,
    catNew: '新着', catSales: 'セール', catAnalysis: '分析', catIndustry: '業界', catNotice: 'お知らせ',
    originalContent: 'オリジナルコンテンツ', originalContentSub: '独自の分析・特集ページ',
    todaysPick: '今日の1本', birthdays: '誕生日', annualBest: '年間ベスト', weeklyTrend: '週間トレンド',
    rookies: '新人', hiddenGems: '隠れ名作', reviewers: 'レビュアー', lists: 'リスト', vote: '投票', aiSearch: 'AI検索',
  },
  en: {
    noHistory: 'No viewing history', recentActresses: 'Recent actresses', recentProducts: 'Recent products',
    moreRecommendations: 'More recommendations', moreNewReleases: 'More new releases',
    allGenres: 'All genres', allActresses: 'All actresses', allNews: 'All news',
    saleSubtitle: 'Limited time deals!', recentlyViewed: 'Recently Viewed', recentlyViewedSub: 'From your history',
    recommendations: 'Recommended for You', recommendationsSub: 'Based on your viewing history',
    weeklyHighlights: 'Weekly Highlights', weeklyHighlightsSub: 'Trending actresses & products',
    news: 'News', newsSub: 'Latest updates, sales & trends',
    trending: 'Trending', trendingSub: 'Popular genres & actress rankings',
    fanzaSite: 'FANZA Site', fanzaSiteSub: 'Dedicated FANZA sister site',
    // sub-component labels
    saleActresses: 'Sale Actresses', saleProducts: 'Sale Products',
    recommendHint: 'Recommendations based on your viewing history',
    recommendedActresses: 'Recommended Actresses', recommendedProducts: 'Recommended Products',
    featuredActresses: 'Featured Actresses', featuredProducts: 'Featured Products',
    popularGenres: 'Popular Genres', popularActresses: 'Popular Actresses',
    productsCount: (n: number) => `${n} titles`,
    noNews: 'No news yet',
    saleTitle: (count: number) => `🔥 ${count} On Sale`,
    saleCta: '🔥 View All Sale Products',
    saleCtaSub: (count: number) => `Check ${count}+ deals →`,
    catNew: 'New', catSales: 'Sale', catAnalysis: 'Analysis', catIndustry: 'Industry', catNotice: 'Notice',
    originalContent: 'Original Content', originalContentSub: 'Exclusive analysis and features',
    todaysPick: "Today's Pick", birthdays: 'Birthdays', annualBest: 'Annual Best', weeklyTrend: 'Weekly',
    rookies: 'Rookies', hiddenGems: 'Hidden Gems', reviewers: 'Reviewers', lists: 'Lists', vote: 'Vote', aiSearch: 'AI Search',
  },
} as const;
function getSectionText(locale: string) { return sectionTexts[locale as keyof typeof sectionTexts] || sectionTexts.ja; }

// 最近見た作品コンテンツ
function RecentlyViewedContent({ locale }: { locale: string }) {
  const { items: recentlyViewed, isLoading: historyLoading } = useRecentlyViewed();
  const [products, setProducts] = useState<Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    performers?: Array<{ id: number; name: string }>;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (historyLoading || recentlyViewed.length === 0 || hasFetched) return;

    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const ids = recentlyViewed.slice(0, 8).map(item => item.id);
        const response = await fetch(`/api/products?ids=${ids.join(',')}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          const productList = Array.isArray(data.products) ? data.products : [];
          // 閲覧順を維持
          const productMap = new Map(productList.map((p: { id: number }) => [String(p.id), p]));
          const ordered = ids.map(id => productMap.get(id)).filter(Boolean);
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
    return () => { cancelled = true; };
  }, [historyLoading, recentlyViewed, hasFetched]);

  if (historyLoading || recentlyViewed.length === 0) {
    return <p className="text-gray-400 text-sm">{getSectionText(locale).noHistory}</p>;
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
  products.forEach(product => {
    product.performers?.forEach(performer => {
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
          <h4 className="text-xs font-semibold text-blue-400 mb-2">{getSectionText(locale).recentActresses}</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                }}
                size="mini"
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-2">{getSectionText(locale).recentProducts}</h4>
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
              theme="dark"
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

  // 女優を抽出（重複排除、画像URLも含む）
  const actressMap = new Map<number, { id: number; name: string; profileImageUrl?: string | null }>();
  products.forEach(product => {
    product.performers?.forEach(performer => {
      if (!actressMap.has(performer.id)) {
        actressMap.set(performer.id, performer);
      }
    });
  });
  // 画像がある女優を優先的に表示
  const allActresses = Array.from(actressMap.values());
  const actresses = [
    ...allActresses.filter(a => a.profileImageUrl),
    ...allActresses.filter(a => !a.profileImageUrl),
  ].slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 女優 */}
      {actresses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-400 mb-2">{getSectionText(locale).saleActresses}</h4>
          <div className={GRID_CLASSES}>
            {actresses.map((actress) => (
              <ActressCardBase
                key={actress.id}
                actress={{
                  id: String(actress.id),
                  name: actress.name,
                  heroImage: actress.profileImageUrl ?? undefined,
                }}
                size="mini"
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-2">{getSectionText(locale).saleProducts}</h4>
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
                theme="dark"
              />
              {/* 割引バッジ */}
              <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1 py-0.5 rounded z-10">
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
  const [products, setProducts] = useState<Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    releaseDate: string | null;
  }>>([]);
  const [actresses, setActresses] = useState<Array<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
  }>>([]);
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
          history: recentlyViewed.slice(0, 10).map(item => ({
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
    return <p className="text-gray-400 text-sm">{getSectionText(locale).recommendHint}</p>;
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
          <h4 className="text-xs font-semibold text-purple-400 mb-2">{getSectionText(locale).recommendedActresses}</h4>
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
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      {products.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">{getSectionText(locale).recommendedProducts}</h4>
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
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* もっと見る */}
      <MoreLink href="/discover" label={getSectionText(locale).moreRecommendations} locale={locale} />
    </div>
  );
}

// 今週の注目コンテンツ
function WeeklyHighlightsContent({ locale }: { locale: string }) {
  const [actresses, setActresses] = useState<Array<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
  }>>([]);
  const [products, setProducts] = useState<Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    releaseDate: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const response = await fetch('/api/weekly-highlights');
        if (response.ok) {
          const data = await response.json();
          setActresses(data.trendingActresses?.slice(0, 6) || []);
          setProducts([
            ...(data.hotNewReleases?.slice(0, 4) || []),
            ...(data.rediscoveredClassics?.slice(0, 4) || []),
          ]);
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
          <h4 className="text-xs font-semibold text-amber-400 mb-2">{getSectionText(locale).featuredActresses}</h4>
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
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* 作品 */}
      {products.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">{getSectionText(locale).featuredProducts}</h4>
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
                theme="dark"
              />
            ))}
          </div>
        </div>
      )}
      {/* もっと見る */}
      <MoreLink href="/products" label={getSectionText(locale).moreNewReleases} locale={locale} />
    </div>
  );
}

// 「もっと見る」リンクコンポーネント
function MoreLink({ href, label, locale }: { href: string; label: string; locale?: string }) {
  const localizedUrl = locale ? localizedHref(href, locale) : href;
  return (
    <Link
      href={localizedUrl}
      className="mt-3 flex items-center justify-center gap-1 w-full py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-700/50 rounded-lg transition-colors"
    >
      {label}
      <ExternalLink className="w-4 h-4" />
    </Link>
  );
}

// トレンド分析コンテンツ
function TrendingContent({ locale }: { locale: string }) {
  const [tags, setTags] = useState<Array<{ name: string; count: number; id?: number }>>([]);
  const [performers, setPerformers] = useState<Array<{ name: string; count: number; id?: number }>>([]);
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
          <div key={i} className="h-8 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ジャンル */}
        {tags.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-blue-400 mb-2">{getSectionText(locale).popularGenres}</h4>
            <div className="space-y-1">
              {tags.map((tag, index) => (
                <a
                  key={tag.name}
                  href={tag.id ? localizedHref(`/tags/${tag.id}`, locale) : '#'}
                  className="flex items-center gap-2 p-2 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    index < 3 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="text-sm text-white flex-1">{tag.name}</span>
                  <span className="text-xs text-gray-400">{getSectionText(locale).productsCount(tag.count)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {/* 女優 */}
        {performers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-pink-400 mb-2">{getSectionText(locale).popularActresses}</h4>
            <div className="space-y-1">
              {performers.map((performer, index) => (
                <a
                  key={performer.name}
                  href={performer.id ? localizedHref(`/actress/${performer.id}`, locale) : '#'}
                  className="flex items-center gap-2 p-2 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    index < 3 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="text-sm text-white flex-1">{performer.name}</span>
                  <span className="text-xs text-gray-400">{getSectionText(locale).productsCount(performer.count)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* もっと見るリンク */}
      <div className="grid grid-cols-2 gap-2">
        <MoreLink href="/tags" label={getSectionText(locale).allGenres} locale={locale} />
        <MoreLink href="/actresses" label={getSectionText(locale).allActresses} locale={locale} />
      </div>
    </div>
  );
}

// カテゴリバッジのスタイル
function getCategoryStyles(locale: string): Record<string, { bg: string; text: string; label: string }> {
  const t = getSectionText(locale);
  return {
    new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: t.catNew },
    sales: { bg: 'bg-red-600', text: 'text-red-100', label: t.catSales },
    ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: t.catAnalysis },
    industry: { bg: 'bg-green-600', text: 'text-green-100', label: t.catIndustry },
    site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: t.catNotice },
  };
}

// ニュースコンテンツ
function NewsContent({ locale }: { locale: string }) {
  const [articles, setArticles] = useState<Array<{
    id: number;
    slug: string;
    category: string;
    title: string;
    excerpt: string | null;
    featured: boolean;
    published_at: string;
  }>>([]);
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
          <div key={i} className="h-16 bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <p className="text-gray-400 text-sm">{getSectionText(locale).noNews}</p>;
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const catStyles = getCategoryStyles(locale);
        const style = catStyles[article.category] || catStyles['site_update'];
        const localeMap: Record<string, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR', 'zh-TW': 'zh-TW' };
        const publishedDate = new Date(article.published_at).toLocaleDateString(localeMap[locale] || 'ja-JP', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <a
            key={article.id}
            href={localizedHref(`/news/${article.slug}`, locale)}
            className={`block p-3 rounded-lg transition-colors ${
              article.featured
                ? 'bg-gradient-to-r from-gray-700/80 to-gray-700/40 border border-yellow-600/30 hover:border-yellow-500/50'
                : 'bg-gray-700/50 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-gray-400">{publishedDate}</span>
                  {article.featured && (
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <h4 className="text-sm font-medium text-white line-clamp-1">
                  {article.title}
                </h4>
                {article.excerpt && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                    {article.excerpt}
                  </p>
                )}
              </div>
            </div>
          </a>
        );
      })}
      <MoreLink href="/news" label={getSectionText(locale).allNews} locale={locale} />
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
      {/* セール情報 - デフォルトOPENで訴求強化 */}
      {saleProducts.length > 0 && isSectionVisible('sale') && (
        <div id="sale" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Tag className="w-5 h-5 text-red-400" />}
            title={getSectionText(locale).saleTitle(saleProducts.length)}
            subtitle={getSectionText(locale).saleSubtitle}
            theme="dark"
            defaultOpen={true}
          >
            <SaleProductsContent products={saleProducts} locale={locale} />
            {/* セール一覧ページへの大型CTA */}
            <a
              href={localizedHref('/sales', locale)}
              className="mt-4 flex flex-col items-center justify-center gap-1 w-full py-4 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 hover:from-red-500 hover:via-orange-400 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 transition-all transform hover:scale-105"
            >
              <span className="text-xl flex items-center gap-2">
                {getSectionText(locale).saleCta}
                <ExternalLink className="w-5 h-5" />
              </span>
              <span className="text-sm opacity-90">
                {getSectionText(locale).saleCtaSub(saleProducts.length)}
              </span>
            </a>
          </TopPageMenuSection>
        </div>
      )}

      {/* 最近見た作品 */}
      {isSectionVisible('recently-viewed') && (
        <div id="recently-viewed" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Clock className="w-5 h-5" />}
            title={getSectionText(locale).recentlyViewed}
            subtitle={getSectionText(locale).recentlyViewedSub}
            theme="dark"
            defaultOpen={false}
          >
            <RecentlyViewedContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}
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
 * - FANZA専門サイト
 */
export function TopPageLowerSections({
  locale,
  uncategorizedCount,
  isTopPage,
  isFanzaSite = false,
  translations: t,
  pageId = 'home',
}: Omit<TopPageSectionsProps, 'saleProducts'> & { pageId?: string }) {
  const { isSectionVisible } = useHomeSections({ locale, pageId });

  return (
    <div className="space-y-3">
      {/* あなたへのおすすめ - エンゲージメント向上のためデフォルトOPEN */}
      {isSectionVisible('recommendations') && (
        <div id="recommendations" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Sparkles className="w-5 h-5" />}
            title={getSectionText(locale).recommendations}
            subtitle={getSectionText(locale).recommendationsSub}
            theme="dark"
            defaultOpen={true}
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
            icon={<TrendingUp className="w-5 h-5" />}
            title={getSectionText(locale).weeklyHighlights}
            subtitle={getSectionText(locale).weeklyHighlightsSub}
            theme="dark"
            defaultOpen={true}
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
            icon={<Newspaper className="w-5 h-5" />}
            title={getSectionText(locale).news}
            subtitle={getSectionText(locale).newsSub}
            theme="dark"
            defaultOpen={true}
          >
            <NewsContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* トレンド分析 */}
      {isTopPage && isSectionVisible('trending') && (
        <div id="trending" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<BarChart3 className="w-5 h-5" />}
            title={getSectionText(locale).trending}
            subtitle={getSectionText(locale).trendingSub}
            theme="dark"
            defaultOpen={false}
          >
            <TrendingContent locale={locale} />
          </TopPageMenuSection>
        </div>
      )}

      {/* 分割線 */}
      <div className="border-t border-gray-700/50 my-2" />

      {/* オリジナルコンテンツ */}
      {isSectionVisible('original-content') && (() => {
        const oc = getSectionText(locale);
        return (
        <div id="original-content" className="scroll-mt-20">
          <TopPageMenuSection
            type="accordion"
            icon={<Sparkles className="w-5 h-5" />}
            title={oc.originalContent}
            subtitle={oc.originalContentSub}
            theme="dark"
            defaultOpen={true}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <a
                href={localizedHref('/daily-pick', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Play className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.todaysPick}
                </span>
              </a>
              <a
                href={localizedHref('/birthdays', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Cake className="w-4 h-4 text-pink-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.birthdays}
                </span>
              </a>
              <a
                href={localizedHref(`/best/${new Date().getFullYear() - 1}`, locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.annualBest}
                </span>
              </a>
              <a
                href={localizedHref('/weekly-report', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.weeklyTrend}
                </span>
              </a>
              <a
                href={localizedHref('/rookies', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Star className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.rookies}
                </span>
              </a>
              <a
                href={localizedHref('/hidden-gems', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Gem className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.hiddenGems}
                </span>
              </a>
              <a
                href={localizedHref('/reviewers', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.reviewers}
                </span>
              </a>
              <a
                href={localizedHref('/lists/ranking', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <List className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.lists}
                </span>
              </a>
              <a
                href={localizedHref('/vote', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <Vote className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.vote}
                </span>
              </a>
              <a
                href={localizedHref('/search/semantic', locale)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-purple-700/50 to-pink-700/50 hover:from-purple-700 hover:to-pink-700 transition-colors"
              >
                <Search className="w-4 h-4 text-purple-300 flex-shrink-0" />
                <span className="text-xs font-medium text-white truncate">
                  {oc.aiSearch}
                </span>
              </a>
            </div>
          </TopPageMenuSection>
        </div>
        );
      })()}

      {/* 商品一覧へのリンク */}
      {isSectionVisible('all-products') && (
        <div id="all-products" className="scroll-mt-20">
          <TopPageMenuSection
            type="link"
            href={localizedHref('/products', locale)}
            icon={<Film className="w-5 h-5" />}
            title={t.viewProductList}
            subtitle={t.viewProductListDesc}
            theme="dark"
          />
        </div>
      )}

      {/* 未整理作品へのリンク */}
      {uncategorizedCount > 0 && isSectionVisible('uncategorized') && (
        <TopPageMenuSection
          type="link"
          href={localizedHref('/products?uncategorized=true', locale)}
          icon={<AlertTriangle className="w-5 h-5" />}
          title={t.uncategorizedDescription}
          badge={t.uncategorizedCount}
          theme="dark"
        />
      )}

      {/* FANZA専門サイトへのバナー */}
      {!isFanzaSite && isSectionVisible('fanza-site') && (
        <>
          <div className="border-t border-gray-700/50 my-2" />
          <TopPageMenuSection
            type="link"
            href="https://fanza.eroxv.com"
            icon={<ExternalLink className="w-5 h-5" />}
            title={getSectionText(locale).fanzaSite}
            subtitle={getSectionText(locale).fanzaSiteSub}
            theme="dark"
          />
        </>
      )}

      {/* ホームセクション管理（トップページのみ） */}
      {isTopPage && <HomeSectionManager locale={locale} theme="dark" />}
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
  isFanzaSite = false,
  translations: t,
}: TopPageSectionsProps) {
  return (
    <div className="space-y-6">
      <TopPageUpperSections locale={locale} saleProducts={saleProducts} />
      <TopPageLowerSections
        locale={locale}
        uncategorizedCount={uncategorizedCount}
        isTopPage={isTopPage}
        isFanzaSite={isFanzaSite}
        translations={t}
      />
    </div>
  );
}
