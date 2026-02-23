'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  X,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Clock,
  User,
  Undo2,
  Settings2,
  Calendar,
  Play,
  List,
  Eye,
  Filter,
} from 'lucide-react';
import { useFavorites } from '@adult-v/shared/hooks';
import { localizedHref } from '@adult-v/shared/i18n';
import { PageSectionNav } from '@adult-v/shared/components';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';

interface DiscoverProduct {
  id: number;
  title: string;
  imageUrl: string;
  sampleImages: string[] | null;
  releaseDate: string | null;
  duration: number | null;
  price: number | null;
  provider: string | null;
  affiliateUrl: string | null;
  performers: string[];
  genres?: string[];
  maker?: string | null;
}

interface HistoryItem {
  product: DiscoverProduct;
  action: 'like' | 'pass';
  timestamp: number;
}

interface DiscoverFilters {
  minDuration?: number;
  maxDuration?: number;
  hasPerformer?: boolean;
  releasedAfter?: string;
}

const translations = {
  ja: {
    title: '発掘モード',
    subtitle: 'ランダムに作品を発見。気になる作品をお気に入りに追加しよう',
    loading: '作品を探しています...',
    noMore: 'これ以上の作品がありません',
    tryAgain: 'もう一度試す',
    interested: 'お気に入り',
    pass: 'パス',
    viewDetails: '詳細',
    buyNow: '購入',
    duration: '分',
    addedToFavorites: 'お気に入りに追加しました',
    passedCount: 'パス',
    likedCount: 'お気に入り',
    reset: 'リセット',
    undo: '元に戻す',
    filters: 'フィルター',
    filterDuration: '再生時間',
    filterDurationAny: '指定なし',
    filterDurationShort: '60分以下',
    filterDurationMedium: '60-120分',
    filterDurationLong: '120分以上',
    filterPerformer: '出演者あり',
    filterRecent: '最近1年以内',
    applyFilters: '適用',
    clearFilters: 'クリア',
    history: '履歴',
    likedProducts: 'お気に入りした作品',
    passedProducts: 'パスした作品',
    noHistory: '履歴がありません',
    loadMore: 'もっと見る',
    shuffleMore: 'シャッフルして次へ',
  },
  en: {
    title: 'Discover Mode',
    subtitle: 'Discover random content. Add interesting ones to favorites',
    loading: 'Finding products...',
    noMore: 'No more products',
    tryAgain: 'Try again',
    interested: 'Like',
    pass: 'Pass',
    viewDetails: 'Details',
    buyNow: 'Buy',
    duration: 'min',
    addedToFavorites: 'Added to favorites',
    passedCount: 'Passed',
    likedCount: 'Liked',
    reset: 'Reset',
    undo: 'Undo',
    filters: 'Filters',
    filterDuration: 'Duration',
    filterDurationAny: 'Any',
    filterDurationShort: '≤60min',
    filterDurationMedium: '60-120min',
    filterDurationLong: '≥120min',
    filterPerformer: 'Has performer',
    filterRecent: 'Last year',
    applyFilters: 'Apply',
    clearFilters: 'Clear',
    history: 'History',
    likedProducts: 'Liked products',
    passedProducts: 'Passed products',
    noHistory: 'No history',
    loadMore: 'Load More',
    shuffleMore: 'Shuffle & Next',
  },
  zh: {
    title: '发现模式',
    subtitle: '随机发现作品，将感兴趣的添加到收藏',
    loading: '正在寻找作品...',
    noMore: '没有更多作品',
    tryAgain: '再试一次',
    interested: '收藏',
    pass: '跳过',
    viewDetails: '详情',
    buyNow: '购买',
    duration: '分钟',
    addedToFavorites: '已添加到收藏',
    passedCount: '跳过',
    likedCount: '收藏',
    reset: '重置',
    undo: '撤销',
    filters: '筛选',
    filterDuration: '时长',
    filterDurationAny: '不限',
    filterDurationShort: '≤60分钟',
    filterDurationMedium: '60-120分钟',
    filterDurationLong: '≥120分钟',
    filterPerformer: '有演员',
    filterRecent: '近一年',
    applyFilters: '应用',
    clearFilters: '清除',
    history: '历史',
    likedProducts: '收藏的作品',
    passedProducts: '跳过的作品',
    noHistory: '暂无历史',
    loadMore: '加载更多',
    shuffleMore: '随机切换',
  },
  'zh-TW': {
    title: '發現模式',
    subtitle: '隨機發現作品，將感興趣的新增到收藏',
    loading: '正在尋找作品...',
    noMore: '沒有更多作品',
    tryAgain: '再試一次',
    interested: '收藏',
    pass: '跳過',
    viewDetails: '詳情',
    buyNow: '購買',
    duration: '分鐘',
    addedToFavorites: '已新增到收藏',
    passedCount: '跳過',
    likedCount: '收藏',
    reset: '重設',
    undo: '撤銷',
    filters: '篩選',
    filterDuration: '時長',
    filterDurationAny: '不限',
    filterDurationShort: '≤60分鐘',
    filterDurationMedium: '60-120分鐘',
    filterDurationLong: '≥120分鐘',
    filterPerformer: '有演員',
    filterRecent: '近一年',
    applyFilters: '套用',
    clearFilters: '清除',
    history: '歷史',
    likedProducts: '收藏的作品',
    passedProducts: '跳過的作品',
    noHistory: '暫無歷史',
    loadMore: '載入更多',
    shuffleMore: '隨機切換',
  },
  ko: {
    title: '발견 모드',
    subtitle: '무작위로 작품을 발견하고 관심 있는 작품을 즐겨찾기에 추가하세요',
    loading: '작품을 찾는 중...',
    noMore: '더 이상 작품이 없습니다',
    tryAgain: '다시 시도',
    interested: '좋아요',
    pass: '패스',
    viewDetails: '상세',
    buyNow: '구매',
    duration: '분',
    addedToFavorites: '즐겨찾기에 추가됨',
    passedCount: '패스',
    likedCount: '좋아요',
    reset: '리셋',
    undo: '실행 취소',
    filters: '필터',
    filterDuration: '재생 시간',
    filterDurationAny: '전체',
    filterDurationShort: '≤60분',
    filterDurationMedium: '60-120분',
    filterDurationLong: '≥120분',
    filterPerformer: '출연자 있음',
    filterRecent: '최근 1년',
    applyFilters: '적용',
    clearFilters: '초기화',
    history: '기록',
    likedProducts: '좋아요한 작품',
    passedProducts: '패스한 작품',
    noHistory: '기록 없음',
    loadMore: '더 보기',
    shuffleMore: '셔플 후 다음',
  },
} as const;

type TranslationKey = keyof typeof translations;

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

export default function DiscoverPage() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as TranslationKey] || translations.ja;

  const { addFavorite, isFavorite } = useFavorites();
  const [products, setProducts] = useState<DiscoverProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [actionFeedback, setActionFeedback] = useState<Record<number, 'like' | 'pass'>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [pendingFilters, setPendingFilters] = useState<DiscoverFilters>({});

  // PageLayout用のデータ
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  // Stats
  const likedCount = history.filter((h) => h.action === 'like').length;
  const passedCount = history.filter((h) => h.action === 'pass').length;

  useEffect(() => {
    fetch('/api/products/on-sale?limit=24&minDiscount=30')
      .then((res) => res.json())
      .then((data) => setSaleProducts(data.products || []))
      .catch(() => {});

    fetch('/api/products/uncategorized-count')
      .then((res) => res.json())
      .then((data) => setUncategorizedCount(data.count || 0))
      .catch(() => {});
  }, []);

  const layoutTranslations = {
    viewProductList: '作品一覧',
    viewProductListDesc: '全ての配信サイトの作品を横断検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  const fetchProducts = useCallback(
    async (newExcludeIds: number[] = excludeIds, currentFilters: DiscoverFilters = filters) => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (newExcludeIds.length > 0) {
          searchParams.set('excludeIds', newExcludeIds.join(','));
        }
        searchParams.set('locale', locale);
        searchParams.set('limit', '12');

        // Apply filters
        if (currentFilters.minDuration) {
          searchParams.set('minDuration', String(currentFilters.minDuration));
        }
        if (currentFilters.maxDuration) {
          searchParams.set('maxDuration', String(currentFilters.maxDuration));
        }
        if (currentFilters.hasPerformer) {
          searchParams.set('hasPerformer', 'true');
        }
        if (currentFilters.releasedAfter) {
          searchParams.set('releasedAfter', currentFilters.releasedAfter);
        }

        const res = await fetch(`/api/discover?${searchParams.toString()}`);
        const data = await res.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [excludeIds, locale, filters],
  );

  useEffect(() => {
    fetchProducts([], filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLike = useCallback(
    (product: DiscoverProduct) => {
      if (actionFeedback[product.id]) return;

      // Add to favorites
      if (!isFavorite('product', product.id)) {
        addFavorite({
          id: product.id,
          type: 'product',
          title: product.title,
          thumbnail: product.imageUrl,
        });
      }

      // Add to history
      setHistory((prev) => [...prev, { product, action: 'like', timestamp: Date.now() }]);

      // Show feedback animation
      setActionFeedback((prev) => ({ ...prev, [product.id]: 'like' }));

      // Remove from display after animation
      setTimeout(() => {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setExcludeIds((prev) => [...prev, product.id]);
        setActionFeedback((prev) => {
          const updated = { ...prev };
          delete updated[product.id];
          return updated;
        });
      }, 300);
    },
    [isFavorite, addFavorite, actionFeedback],
  );

  const handlePass = useCallback(
    (product: DiscoverProduct) => {
      if (actionFeedback[product.id]) return;

      // Add to history
      setHistory((prev) => [...prev, { product, action: 'pass', timestamp: Date.now() }]);

      // Show feedback animation
      setActionFeedback((prev) => ({ ...prev, [product.id]: 'pass' }));

      // Remove from display after animation
      setTimeout(() => {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setExcludeIds((prev) => [...prev, product.id]);
        setActionFeedback((prev) => {
          const updated = { ...prev };
          delete updated[product.id];
          return updated;
        });
      }, 300);
    },
    [actionFeedback],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const lastItem = history[history.length - 1];
    if (!lastItem) return;
    setHistory((prev) => prev.slice(0, -1));
    setExcludeIds((prev) => prev.filter((id) => id !== lastItem.product.id));
    setProducts((prev) => [lastItem.product, ...prev]);
  }, [history]);

  const handleReset = useCallback(() => {
    setExcludeIds([]);
    setHistory([]);
    fetchProducts([], filters);
  }, [fetchProducts, filters]);

  const handleLoadMore = useCallback(() => {
    const currentIds = products.map((p) => p.id);
    const newExcludeIds = [...new Set([...excludeIds, ...currentIds])];
    setExcludeIds(newExcludeIds);
    fetchProducts(newExcludeIds, filters);
  }, [products, excludeIds, fetchProducts, filters]);

  const handleApplyFilters = useCallback(() => {
    setFilters(pendingFilters);
    setShowFilters(false);
    setExcludeIds([]);
    setHistory([]);
    fetchProducts([], pendingFilters);
  }, [pendingFilters, fetchProducts]);

  const handleClearFilters = useCallback(() => {
    setPendingFilters({});
    setFilters({});
    setShowFilters(false);
    setExcludeIds([]);
    setHistory([]);
    fetchProducts([], {});
  }, [fetchProducts]);

  // Section navigation labels
  const sectionLabels: Record<string, Record<string, string>> = {
    ja: { discover: '発掘モード' },
    en: { discover: 'Discover Mode' },
    zh: { discover: '发现模式' },
    'zh-TW': { discover: '發現模式' },
    ko: { discover: '발견 모드' },
  };

  // Duration filter options
  const durationOptions = [
    { value: 'any', label: t.filterDurationAny, min: undefined, max: undefined },
    { value: 'short', label: t.filterDurationShort, min: undefined, max: 60 },
    { value: 'medium', label: t.filterDurationMedium, min: 60, max: 120 },
    { value: 'long', label: t.filterDurationLong, min: 120, max: undefined },
  ];

  const getDurationValue = () => {
    if (!pendingFilters.minDuration && !pendingFilters.maxDuration) return 'any';
    if (!pendingFilters.minDuration && pendingFilters.maxDuration === 60) return 'short';
    if (pendingFilters.minDuration === 60 && pendingFilters.maxDuration === 120) return 'medium';
    if (pendingFilters.minDuration === 120) return 'long';
    return 'any';
  };

  return (
    <div className="theme-body min-h-screen bg-gray-50">
      {/* Section Navigation */}
      <PageSectionNav
        locale={locale}
        config={{
          hasSale: saleProducts.length > 0,
          hasRecentlyViewed: true,
          mainSectionId: 'discover',
          mainSectionLabel: sectionLabels[locale]?.['discover'] ?? sectionLabels['ja']?.['discover'] ?? 'Discover',
          hasRecommendations: true,
          hasWeeklyHighlights: true,
          hasTrending: true,
          hasAllProducts: true,
        }}
        theme="light"
        pageId="discover"
      />

      {/* Upper Sections */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={saleProducts} pageId="discover" />
        </div>
      </section>

      <div id="discover" className="min-h-screen scroll-mt-20 bg-white">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              <Sparkles className="h-6 w-6 text-amber-500" />
              {t.title}
            </h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{t.subtitle}</p>

            {/* Stats Bar */}
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-rose-500">
                <Heart className="h-4 w-4 fill-rose-500" />
                <span className="font-medium">{likedCount}</span>
                <span className="text-gray-500">{t.likedCount}</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5 text-gray-500">
                <X className="h-4 w-4" />
                <span className="font-medium">{passedCount}</span>
                <span className="text-gray-500">{t.passedCount}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                {t.undo}
              </button>
              <button
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${Object.keys(filters).length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'} rounded-lg text-sm transition-colors hover:bg-gray-200`}
              >
                <Filter className="h-4 w-4" />
                {t.filters}
                {Object.keys(filters).length > 0 && <span className="h-2 w-2 rounded-full bg-rose-500" />}
              </button>
              <button
                onClick={() => setShowHistory(true)}
                disabled={history.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <List className="h-4 w-4" />
                {t.history}
              </button>
              {(likedCount > 0 || passedCount > 0) && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t.reset}
                </button>
              )}
            </div>
          </div>

          {/* Main Content - Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="aspect-3/4 bg-gray-200" />
                  <div className="p-3">
                    <div className="mb-2 h-4 rounded bg-gray-200" />
                    <div className="h-3 w-2/3 rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="mx-auto max-w-md rounded-2xl bg-gray-100 p-8 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-600">{t.noMore}</p>
              <button
                onClick={handleReset}
                className="mt-4 rounded-lg bg-rose-500 px-6 py-2 text-white transition-colors hover:bg-rose-600"
              >
                {t.tryAgain}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 ${
                      actionFeedback[product.id] === 'like'
                        ? 'translate-x-8 scale-95 rotate-3 opacity-0'
                        : actionFeedback[product.id] === 'pass'
                          ? '-translate-x-8 scale-95 -rotate-3 opacity-0'
                          : 'hover:scale-[1.02] hover:shadow-md'
                    }`}
                  >
                    {/* Image */}
                    <Link href={localizedHref(`/products/${product.id}`, locale)}>
                      <div className="relative aspect-3/4 bg-gray-100">
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                        />

                        {/* Feedback Overlay */}
                        {actionFeedback[product.id] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                            {actionFeedback[product.id] === 'like' ? (
                              <Heart className="h-12 w-12 fill-rose-500 text-rose-500" />
                            ) : (
                              <X className="h-12 w-12 text-gray-400" />
                            )}
                          </div>
                        )}

                        {/* Price Badge */}
                        {product.price && (
                          <div className="absolute top-2 right-2 rounded bg-white/90 px-2 py-0.5 text-xs font-medium text-emerald-600 shadow">
                            ¥{product.price.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="mb-2 line-clamp-2 min-h-10 text-sm font-medium text-gray-900">{product.title}</h3>

                      {/* Meta */}
                      <div className="mb-2 flex flex-wrap gap-1 text-xs text-gray-600">
                        {product.performers.length > 0 && (
                          <span className="flex max-w-full items-center gap-0.5 truncate rounded bg-gray-100 px-1.5 py-0.5">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{product.performers[0]}</span>
                            {product.performers.length > 1 && <span>+{product.performers.length - 1}</span>}
                          </span>
                        )}
                        {product.duration && (
                          <span className="flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5">
                            <Play className="h-3 w-3" />
                            {product.duration}
                            {t.duration}
                          </span>
                        )}
                      </div>

                      {/* Genres */}
                      {product.genres && product.genres.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {product.genres.slice(0, 2).map((genre) => (
                            <span key={genre} className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">
                              {genre}
                            </span>
                          ))}
                          {product.genres.length > 2 && (
                            <span className="text-xs text-gray-400">+{product.genres.length - 2}</span>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePass(product)}
                          disabled={!!actionFeedback[product.id]}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleLike(product)}
                          disabled={!!actionFeedback[product.id]}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-500 py-2 text-sm text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
                        >
                          <Heart className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Secondary Actions */}
                      <div className="mt-2 flex gap-1">
                        <Link
                          href={localizedHref(`/products/${product.id}`, locale)}
                          className="flex flex-1 items-center justify-center gap-1 rounded border border-gray-300 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          <Eye className="h-3 w-3" />
                          {t.viewDetails}
                        </Link>
                        {product.affiliateUrl && (
                          <a
                            href={product.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-500 py-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t.buyNow}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              <div className="mt-8 flex justify-center gap-4">
                <button
                  onClick={handleLoadMore}
                  className="flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-medium text-white transition-colors hover:bg-rose-600"
                >
                  <RefreshCw className="h-5 w-5" />
                  {t.shuffleMore}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <Settings2 className="h-5 w-5" />
                {t.filters}
              </h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Duration Filter */}
            <div className="mb-6">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Clock className="h-4 w-4" />
                {t.filterDuration}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setPendingFilters((prev) => {
                        const newFilters = { ...prev };
                        if (option.min !== undefined) {
                          newFilters.minDuration = option.min;
                        } else {
                          delete newFilters.minDuration;
                        }
                        if (option.max !== undefined) {
                          newFilters.maxDuration = option.max;
                        } else {
                          delete newFilters.maxDuration;
                        }
                        return newFilters;
                      })
                    }
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      getDurationValue() === option.value
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Performer Filter */}
            <div className="mb-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={pendingFilters.hasPerformer || false}
                  onChange={(e) =>
                    setPendingFilters((prev) => {
                      const newFilters = { ...prev };
                      if (e.target.checked) {
                        newFilters.hasPerformer = true;
                      } else {
                        delete newFilters.hasPerformer;
                      }
                      return newFilters;
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                />
                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                  <User className="h-4 w-4" />
                  {t.filterPerformer}
                </span>
              </label>
            </div>

            {/* Recent Filter */}
            <div className="mb-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!pendingFilters.releasedAfter}
                  onChange={(e) => {
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                    setPendingFilters((prev) => ({
                      ...prev,
                      releasedAfter: e.target.checked ? oneYearAgo.toISOString().split('T')[0] : undefined,
                    }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                />
                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                  <Calendar className="h-4 w-4" />
                  {t.filterRecent}
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClearFilters}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-gray-700 transition-colors hover:bg-gray-200"
              >
                {t.clearFilters}
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 rounded-xl bg-rose-500 py-3 font-medium text-white transition-colors hover:bg-rose-600"
              >
                {t.applyFilters}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <List className="h-5 w-5" />
                {t.history}
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {history.length === 0 ? (
              <p className="py-8 text-center text-gray-500">{t.noHistory}</p>
            ) : (
              <div className="space-y-4">
                {/* Liked Products */}
                {history.filter((h) => h.action === 'like').length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-rose-500">
                      <Heart className="h-4 w-4 fill-rose-500" />
                      {t.likedProducts} ({history.filter((h) => h.action === 'like').length})
                    </h4>
                    <div className="space-y-2">
                      {history
                        .filter((h) => h.action === 'like')
                        .slice(-10)
                        .reverse()
                        .map((item) => (
                          <Link
                            key={`${item.product.id}-${item.timestamp}`}
                            href={localizedHref(`/products/${item.product.id}`, locale)}
                            className="flex items-center gap-3 rounded-lg bg-gray-50 p-2 transition-colors hover:bg-gray-100"
                          >
                            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-gray-900">{item.product.title}</p>
                              {item.product.performers.length > 0 && (
                                <p className="truncate text-xs text-gray-500">
                                  {item.product.performers.slice(0, 2).join(', ')}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}

                {/* Passed Products */}
                {history.filter((h) => h.action === 'pass').length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-500">
                      <X className="h-4 w-4" />
                      {t.passedProducts} ({history.filter((h) => h.action === 'pass').length})
                    </h4>
                    <div className="space-y-2">
                      {history
                        .filter((h) => h.action === 'pass')
                        .slice(-10)
                        .reverse()
                        .map((item) => (
                          <Link
                            key={`${item.product.id}-${item.timestamp}`}
                            href={localizedHref(`/products/${item.product.id}`, locale)}
                            className="flex items-center gap-3 rounded-lg bg-gray-50/50 p-2 opacity-60 transition-colors hover:bg-gray-100"
                          >
                            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-gray-900">{item.product.title}</p>
                              {item.product.performers.length > 0 && (
                                <p className="truncate text-xs text-gray-500">
                                  {item.product.performers.slice(0, 2).join(', ')}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lower Sections */}
      <section className="py-3 sm:py-4">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={false}
            isFanzaSite={true}
            translations={layoutTranslations}
            pageId="discover"
          />
        </div>
      </section>
    </div>
  );
}
