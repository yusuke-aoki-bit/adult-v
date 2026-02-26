'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Star } from 'lucide-react';
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
    buyNow: '購入',
    details: '詳細',
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
    buyNow: 'Buy',
    details: 'Details',
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
      <ChevronRight className="h-3.5 w-3.5" />
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
      <span className="mt-1 max-w-14 truncate text-center text-[11px] text-gray-300 transition-colors group-hover:text-fuchsia-400">
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
    <Link href={localizedHref(`/products/${id}`, locale)} className="group relative shrink-0">
      <div className="relative h-20 w-14 overflow-hidden rounded-lg bg-gray-700 sm:h-24 sm:w-[68px]">
        {src ? (
          <Image src={src} alt={title} fill className="object-cover" sizes="68px" quality={60} loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">?</div>
        )}
        {badge && (
          <span className="absolute top-0.5 left-0.5 rounded bg-red-600 px-1 py-px text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 max-w-14 truncate text-[11px] text-gray-400 transition-colors group-hover:text-fuchsia-400 sm:max-w-[68px]">
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

// ----- Sale Product Card (with direct affiliate buy button) -----

function SaleProductCard({ product, locale }: { product: SaleProduct; locale: string }) {
  const t = getTexts(locale);
  const src = normalizeImageUrl(product.thumbnailUrl);
  // FANZA compliance: hide purchase links for FANZA products on adult-v
  const isFanza = product.aspName?.toLowerCase() === 'fanza';
  const hasAffiliate = !!product.affiliateUrl && !isFanza;

  return (
    <div className="w-28 shrink-0 sm:w-32">
      <Link href={localizedHref(`/products/${product.productId}`, locale)} className="group relative block">
        <div className="relative aspect-3/4 overflow-hidden rounded-lg bg-gray-700">
          {src ? (
            <Image
              src={src}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="128px"
              quality={60}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">?</div>
          )}
          <span className="absolute top-0.5 left-0.5 rounded-md bg-linear-to-r from-red-600 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            -{product.discountPercent}%
          </span>
        </div>
      </Link>
      <p className="mt-1 line-clamp-1 text-[11px] font-medium text-gray-300">{product.title}</p>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-xs font-bold text-red-400">¥{product.salePrice.toLocaleString()}</span>
        <span className="text-[9px] text-gray-500 line-through">¥{product.regularPrice.toLocaleString()}</span>
      </div>
      {hasAffiliate ? (
        <a
          href={product.affiliateUrl!}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-1.5 block w-full rounded-md bg-linear-to-r from-red-600 to-orange-500 py-1.5 text-center text-[10px] font-bold text-white shadow-sm transition-all hover:from-red-500 hover:to-orange-400"
        >
          {t.buyNow} &rarr;
        </a>
      ) : (
        <Link
          href={localizedHref(`/products/${product.productId}`, locale)}
          className="mt-1.5 block w-full rounded-md bg-gray-700 py-1.5 text-center text-[10px] font-bold text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
        >
          {t.details} &rarr;
        </Link>
      )}
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
            <SaleProductCard key={p.productId} product={p} locale={locale} />
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

// ===== Lazy Loading =====

/** Defers rendering until the element is near the viewport */
function LazySection({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{visible ? children : <Skeletons />}</div>;
}

// ===== Main Component =====

export default function DiscoveryTabs({ locale, saleProducts }: DiscoveryTabsProps) {
  const recentlyViewedData = useRecentlyViewed();
  const hasHistory = !recentlyViewedData.isLoading && recentlyViewedData.items.length > 0;
  const hasEnoughForRecs = !recentlyViewedData.isLoading && recentlyViewedData.items.length >= 3;

  const sectionLabels =
    locale === 'en'
      ? { sale: 'Sale', weekly: 'This Week', news: 'News', forYou: 'For You', recent: 'Recent' }
      : { sale: 'セール', weekly: '今週の注目', news: 'ニュース', forYou: 'おすすめ', recent: '最近見た' };

  return (
    <div className="container mx-auto mt-4 space-y-1 px-3 sm:px-4">
      {/* Sale Products — immediate render (data from props) */}
      {saleProducts.length > 0 && (
        <section className="rounded-xl bg-white/3 p-3 ring-1 ring-white/5 sm:p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                clipRule="evenodd"
              />
            </svg>
            {sectionLabels.sale}
          </h3>
          <SaleTab products={saleProducts} locale={locale} />
        </section>
      )}

      {/* Weekly Highlights — lazy loaded on scroll */}
      <section className="rounded-xl bg-white/3 p-3 ring-1 ring-white/5 sm:p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {sectionLabels.weekly}
        </h3>
        <LazySection>
          <WeeklyTab locale={locale} />
        </LazySection>
      </section>

      {/* News — lazy loaded on scroll */}
      <section className="rounded-xl bg-white/3 p-3 ring-1 ring-white/5 sm:p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-400">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          {sectionLabels.news}
        </h3>
        <LazySection>
          <NewsTab locale={locale} />
        </LazySection>
      </section>

      {/* Recommendations — only for returning users with 3+ history */}
      {hasEnoughForRecs && (
        <section className="rounded-xl bg-white/3 p-3 ring-1 ring-white/5 sm:p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-purple-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {sectionLabels.forYou}
          </h3>
          <LazySection>
            <RecommendationsTab locale={locale} recentlyViewedData={recentlyViewedData} />
          </LazySection>
        </section>
      )}

      {/* Recently Viewed — only for returning users */}
      {hasHistory && (
        <section className="rounded-xl bg-white/3 p-3 ring-1 ring-white/5 sm:p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {sectionLabels.recent}
          </h3>
          <LazySection>
            <RecentlyViewedTab locale={locale} recentlyViewedData={recentlyViewedData} />
          </LazySection>
        </section>
      )}
    </div>
  );
}
