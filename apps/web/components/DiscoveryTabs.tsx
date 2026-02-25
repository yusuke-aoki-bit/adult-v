'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Tag, TrendingUp, Clock, Newspaper, ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { localizedHref } from '@adult-v/shared/i18n';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';
import { useRecentlyViewed } from '@adult-v/shared/hooks';

// ===== Types =====

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

interface DiscoveryTabsProps {
  locale: string;
  saleProducts: SaleProduct[];
}

// ===== Constants =====

const SCROLL_ROW = 'hide-scrollbar flex gap-3 overflow-x-auto pb-1';

type TabId = 'recommendations' | 'sale' | 'weekly' | 'news' | 'recently-viewed';

interface TabDef {
  id: TabId;
  icon: React.ReactNode;
  labelKey: string;
}

const TAB_DEFS: TabDef[] = [
  { id: 'recommendations', icon: <Sparkles className="h-4 w-4" />, labelKey: 'recommendations' },
  { id: 'sale', icon: <Tag className="h-4 w-4" />, labelKey: 'sale' },
  { id: 'weekly', icon: <TrendingUp className="h-4 w-4" />, labelKey: 'weekly' },
  { id: 'news', icon: <Newspaper className="h-4 w-4" />, labelKey: 'news' },
  { id: 'recently-viewed', icon: <Clock className="h-4 w-4" />, labelKey: 'recentlyViewed' },
];

// ===== Translations =====

const tabTexts = {
  ja: {
    recommendations: 'おすすめ',
    sale: 'セール',
    weekly: '今週の注目',
    news: 'ニュース',
    recentlyViewed: '最近見た',
    noHistory: '閲覧履歴がありません',
    recentActresses: '最近見た女優',
    recentProducts: '最近見た作品',
    recommendHint: '閲覧履歴に基づいたおすすめを表示します',
    recommendedActresses: 'おすすめ女優',
    recommendedProducts: 'おすすめ作品',
    saleActresses: 'セール中の女優',
    saleProducts: 'セール中の作品',
    featuredActresses: '注目の女優',
    featuredProducts: '注目の作品',
    noSale: '現在セール中の商品はありません',
    noNews: 'ニュースはまだありません',
    moreRecommendations: 'もっとおすすめを見る',
    moreNewReleases: '新作をもっと見る',
    allNews: 'ニュース一覧を見る',
    saleCta: '全セール商品を見る',
    catNew: '新着',
    catSales: 'セール',
    catAnalysis: '分析',
    catIndustry: '業界',
    catNotice: 'お知らせ',
  },
  en: {
    recommendations: 'For You',
    sale: 'Sale',
    weekly: 'This Week',
    news: 'News',
    recentlyViewed: 'Recent',
    noHistory: 'No viewing history',
    recentActresses: 'Recent Actresses',
    recentProducts: 'Recent Products',
    recommendHint: 'Recommendations based on your viewing history',
    recommendedActresses: 'Recommended Actresses',
    recommendedProducts: 'Recommended Products',
    saleActresses: 'Sale Actresses',
    saleProducts: 'Sale Products',
    featuredActresses: 'Featured Actresses',
    featuredProducts: 'Featured Products',
    noSale: 'No sale products at this time',
    noNews: 'No news yet',
    moreRecommendations: 'More recommendations',
    moreNewReleases: 'More new releases',
    allNews: 'All news',
    saleCta: 'View all sales',
    catNew: 'New',
    catSales: 'Sale',
    catAnalysis: 'Analysis',
    catIndustry: 'Industry',
    catNotice: 'Notice',
  },
} as const;

function getTexts(locale: string) {
  return tabTexts[locale as keyof typeof tabTexts] || tabTexts.ja;
}

// ===== Sub-components =====

function MoreLink({ href, label, locale }: { href: string; label: string; locale?: string }) {
  const url = locale ? localizedHref(href, locale) : href;
  return (
    <Link
      href={url}
      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-fuchsia-400 transition-colors hover:bg-gray-700/50 hover:text-fuchsia-300"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}

/** Compact circular avatar chip for actress display in scroll strips */
function ActressChip({
  id,
  name,
  imageUrl,
  locale,
}: {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  locale: string;
}) {
  const src = normalizeImageUrl(imageUrl);
  return (
    <Link href={localizedHref(`/actress/${id}`, locale)} className="group flex shrink-0 flex-col items-center">
      <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-transparent transition-all group-hover:ring-fuchsia-500 sm:h-14 sm:w-14">
        {src ? (
          <Image src={src} alt={name} fill className="object-cover" sizes="56px" quality={60} loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-700 text-xs text-gray-400">
            {name[0]}
          </div>
        )}
      </div>
      <span className="mt-1 max-w-14 truncate text-center text-[10px] text-gray-300 transition-colors group-hover:text-fuchsia-400">
        {name}
      </span>
    </Link>
  );
}

/** Compact product thumbnail for scroll strips */
function ProductChip({
  id,
  title,
  imageUrl,
  locale,
  badge,
}: {
  id: number | string;
  title: string;
  imageUrl?: string | null;
  locale: string;
  badge?: string;
}) {
  const src = normalizeImageUrl(imageUrl);
  return (
    <Link href={localizedHref(`/product/${id}`, locale)} className="group relative shrink-0">
      <div className="relative h-20 w-14 overflow-hidden rounded-lg bg-gray-700 sm:h-24 sm:w-[68px]">
        {src ? (
          <Image src={src} alt={title} fill className="object-cover" sizes="68px" quality={60} loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">?</div>
        )}
        {badge && (
          <span className="absolute top-0.5 left-0.5 rounded bg-red-600 px-1 py-px text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 max-w-14 truncate text-[10px] text-gray-400 transition-colors group-hover:text-fuchsia-400 sm:max-w-[68px]">
        {title}
      </p>
    </Link>
  );
}

// ----- Recently Viewed -----

interface RecentlyViewedItem {
  id: string;
  title?: string;
}

interface RecentlyViewedData {
  items: RecentlyViewedItem[];
  isLoading: boolean;
}

function RecentlyViewedTab({ locale, recentlyViewedData }: { locale: string; recentlyViewedData: RecentlyViewedData }) {
  const t = getTexts(locale);
  const { items: recentlyViewed, isLoading: historyLoading } = recentlyViewedData;
  const [products, setProducts] = useState<
    Array<{ id: number; title: string; imageUrl: string | null; performers?: Array<{ id: number; name: string }> }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (historyLoading || recentlyViewed.length === 0 || hasFetched) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ids = recentlyViewed.slice(0, 8).map((item) => item.id);
        const res = await fetch(`/api/products?ids=${ids.join(',')}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list = Array.isArray(data.products) ? data.products : [];
          const map = new Map(list.map((p: { id: number }) => [String(p.id), p]));
          setProducts(ids.map((id) => map.get(id)).filter(Boolean) as typeof products);
        }
      } catch (e) {
        console.error('[RecentlyViewed]', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasFetched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyLoading, recentlyViewed, hasFetched]);

  if (historyLoading || recentlyViewed.length === 0) {
    return <p className="py-3 text-center text-xs text-gray-400">{t.noHistory}</p>;
  }
  if (loading) return <Skeletons />;

  const actressMap = new Map<number, { id: number; name: string }>();
  products.forEach((p) =>
    p.performers?.forEach((a) => {
      if (!actressMap.has(a.id)) actressMap.set(a.id, a);
    }),
  );
  const actresses = Array.from(actressMap.values()).slice(0, 8);

  return (
    <div className="space-y-3">
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-blue-400">{t.recentActresses}</h4>
          <div className={SCROLL_ROW}>
            {actresses.map((a) => (
              <ActressChip key={a.id} id={a.id} name={a.name} locale={locale} />
            ))}
          </div>
        </div>
      )}
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold text-gray-400">{t.recentProducts}</h4>
        <div className={SCROLL_ROW}>
          {products.map((p) => (
            <ProductChip key={p.id} id={p.id} title={p.title} imageUrl={p.imageUrl} locale={locale} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Sale -----

function SaleTab({ products, locale }: { products: SaleProduct[]; locale: string }) {
  const t = getTexts(locale);
  if (products.length === 0) return <p className="py-3 text-center text-xs text-gray-400">{t.noSale}</p>;

  const actressMap = new Map<number, { id: number; name: string; profileImageUrl?: string | null }>();
  products.forEach((p) =>
    p.performers?.forEach((a) => {
      if (!actressMap.has(a.id)) actressMap.set(a.id, a);
    }),
  );
  const all = Array.from(actressMap.values());
  const actresses = [...all.filter((a) => a.profileImageUrl), ...all.filter((a) => !a.profileImageUrl)].slice(0, 8);

  return (
    <div className="space-y-3">
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-red-400">{t.saleActresses}</h4>
          <div className={SCROLL_ROW}>
            {actresses.map((a) => (
              <ActressChip key={a.id} id={a.id} name={a.name} imageUrl={a.profileImageUrl} locale={locale} />
            ))}
          </div>
        </div>
      )}
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold text-gray-400">{t.saleProducts}</h4>
        <div className={SCROLL_ROW}>
          {products.slice(0, 8).map((p) => (
            <ProductChip
              key={p.productId}
              id={p.productId}
              title={p.title}
              imageUrl={p.thumbnailUrl}
              locale={locale}
              badge={`-${p.discountPercent}%`}
            />
          ))}
        </div>
      </div>
      <MoreLink href="/sales" label={t.saleCta} locale={locale} />
    </div>
  );
}

// ----- Recommendations -----

function RecommendationsTab({
  locale,
  recentlyViewedData,
}: {
  locale: string;
  recentlyViewedData: RecentlyViewedData;
}) {
  const t = getTexts(locale);
  const { items: recentlyViewed, isLoading: historyLoading } = recentlyViewedData;
  const [products, setProducts] = useState<
    Array<{ id: number; title: string; imageUrl: string | null; releaseDate: string | null }>
  >([]);
  const [actresses, setActresses] = useState<Array<{ id: number; name: string; thumbnailUrl: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRecs = useCallback(async () => {
    if (hasFetched || recentlyViewed.length < 3) return;
    setLoading(true);
    try {
      const res = await fetch('/api/recommendations/from-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: recentlyViewed.slice(0, 10).map((i) => ({ id: i.id, title: i.title })),
          limit: 8,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.recommendations || []);
        if (data.userProfile?.topPerformers) setActresses(data.userProfile.topPerformers.slice(0, 8));
      }
    } catch (e) {
      console.error('[Recommendations]', e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [hasFetched, recentlyViewed]);

  useEffect(() => {
    if (!historyLoading && recentlyViewed.length >= 3) fetchRecs();
  }, [historyLoading, recentlyViewed.length, fetchRecs]);

  if (historyLoading || recentlyViewed.length < 3) {
    return <p className="py-3 text-center text-xs text-gray-400">{t.recommendHint}</p>;
  }
  if (loading) return <Skeletons />;

  return (
    <div className="space-y-3">
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-purple-400">{t.recommendedActresses}</h4>
          <div className={SCROLL_ROW}>
            {actresses.map((a) => (
              <ActressChip key={a.id} id={a.id} name={a.name} imageUrl={a.thumbnailUrl} locale={locale} />
            ))}
          </div>
        </div>
      )}
      {products.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-gray-400">{t.recommendedProducts}</h4>
          <div className={SCROLL_ROW}>
            {products.map((p) => (
              <ProductChip key={p.id} id={p.id} title={p.title} imageUrl={p.imageUrl} locale={locale} />
            ))}
          </div>
        </div>
      )}
      <MoreLink href="/discover" label={t.moreRecommendations} locale={locale} />
    </div>
  );
}

// ----- Weekly Highlights -----

function WeeklyTab({ locale }: { locale: string }) {
  const t = getTexts(locale);
  const [actresses, setActresses] = useState<Array<{ id: number; name: string; thumbnailUrl: string | null }>>([]);
  const [products, setProducts] = useState<
    Array<{ id: number; title: string; imageUrl: string | null; releaseDate: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/weekly-highlights');
        if (res.ok) {
          const data = await res.json();
          setActresses(data.trendingActresses?.slice(0, 8) || []);
          setProducts([...(data.hotNewReleases?.slice(0, 4) || []), ...(data.rediscoveredClassics?.slice(0, 4) || [])]);
        }
      } catch (e) {
        console.error('[WeeklyHighlights]', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Skeletons />;

  return (
    <div className="space-y-3">
      {actresses.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-amber-400">{t.featuredActresses}</h4>
          <div className={SCROLL_ROW}>
            {actresses.map((a) => (
              <ActressChip key={a.id} id={a.id} name={a.name} imageUrl={a.thumbnailUrl} locale={locale} />
            ))}
          </div>
        </div>
      )}
      {products.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold text-gray-400">{t.featuredProducts}</h4>
          <div className={SCROLL_ROW}>
            {products.map((p) => (
              <ProductChip key={p.id} id={p.id} title={p.title} imageUrl={p.imageUrl} locale={locale} />
            ))}
          </div>
        </div>
      )}
      <MoreLink href="/products" label={t.moreNewReleases} locale={locale} />
    </div>
  );
}

// ----- News -----

function sanitizeNewsTitle(title: string): string {
  const now = new Date();
  const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  let s = title.replace(/[〇○]月[〇○]日/g, todayStr);
  s = s.replace(/[（(]20\d{2}[/／]\d{1,2}[/／]\d{1,2}[)）]/g, '');
  s = s.replace(/【20\d{2}[/／]\d{1,2}[/／]\d{1,2}】/g, `【${todayStr}】`);
  s = s.replace(/【[〇○]月[〇○]日】/g, `【${todayStr}】`);
  return s.trim();
}

function getCategoryStyles(locale: string): Record<string, { bg: string; text: string; label: string }> {
  const t = getTexts(locale);
  return {
    new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: t.catNew },
    sales: { bg: 'bg-red-600', text: 'text-red-100', label: t.catSales },
    ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: t.catAnalysis },
    industry: { bg: 'bg-green-600', text: 'text-green-100', label: t.catIndustry },
    site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: t.catNotice },
  };
}

function NewsTab({ locale }: { locale: string }) {
  const t = getTexts(locale);
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
    (async () => {
      try {
        const res = await fetch('/api/news?mode=latest&limit=5');
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
        }
      } catch (e) {
        console.error('[News]', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-700" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) return <p className="py-4 text-center text-sm text-gray-400">{t.noNews}</p>;

  const localeMap: Record<string, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR', 'zh-TW': 'zh-TW' };

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const catStyles = getCategoryStyles(locale);
        const style = catStyles[article.category] ?? catStyles['site_update']!;
        const pubDate = new Date(article.published_at).toLocaleDateString(localeMap[locale] || 'ja-JP', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <a
            key={article.id}
            href={localizedHref(`/news/${article.slug}`, locale)}
            className={`block rounded-lg p-3 transition-colors ${
              article.featured
                ? 'border border-yellow-600/30 bg-linear-to-r from-gray-700/80 to-gray-700/40 hover:border-yellow-500/50'
                : 'bg-gray-700/50 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-gray-400">{pubDate}</span>
                  {article.featured && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                </div>
                <h4 className="line-clamp-1 text-sm font-medium text-white">{sanitizeNewsTitle(article.title)}</h4>
                {article.excerpt && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{article.excerpt}</p>}
              </div>
            </div>
          </a>
        );
      })}
      <MoreLink href="/news" label={t.allNews} locale={locale} />
    </div>
  );
}

// ----- Skeleton Helper -----

function Skeletons() {
  return (
    <div className="space-y-3">
      <div className={SCROLL_ROW}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-gray-700 sm:h-14 sm:w-14" />
        ))}
      </div>
      <div className={SCROLL_ROW}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 w-14 shrink-0 animate-pulse rounded-lg bg-gray-700 sm:h-24 sm:w-[68px]" />
        ))}
      </div>
    </div>
  );
}

// ===== Main Component =====

export default function DiscoveryTabs({ locale, saleProducts }: DiscoveryTabsProps) {
  const t = getTexts(locale);
  const [activeTab, setActiveTab] = useState<TabId>('recommendations');
  const [visited, setVisited] = useState<Set<TabId>>(new Set(['recommendations']));
  const recentlyViewedData = useRecentlyViewed();

  const labelMap: Record<string, string> = {
    recommendations: t.recommendations,
    sale: t.sale,
    weekly: t.weekly,
    news: t.news,
    recentlyViewed: t.recentlyViewed,
  };

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    setVisited((prev) => new Set(prev).add(id));
  };

  return (
    <section className="container mx-auto px-3 py-3 sm:px-4">
      {/* Tab Bar */}
      <div className="hide-scrollbar mb-3 flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
        {TAB_DEFS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-fuchsia-500 text-fuchsia-400'
                  : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {labelMap[tab.labelKey]}
            </button>
          );
        })}
      </div>

      {/* Tab Panels — preserve mounted state for visited tabs */}
      {TAB_DEFS.map((tab) => (
        <div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
          {visited.has(tab.id) && (
            <>
              {tab.id === 'recommendations' && (
                <RecommendationsTab locale={locale} recentlyViewedData={recentlyViewedData} />
              )}
              {tab.id === 'sale' && <SaleTab products={saleProducts} locale={locale} />}
              {tab.id === 'weekly' && <WeeklyTab locale={locale} />}
              {tab.id === 'news' && <NewsTab locale={locale} />}
              {tab.id === 'recently-viewed' && (
                <RecentlyViewedTab locale={locale} recentlyViewedData={recentlyViewedData} />
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
