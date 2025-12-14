'use client';

import { useState, useEffect } from 'react';

export interface AspStat {
  aspName: string;
  productCount: number;
  actressCount: number;
  estimatedTotal: number | null;
}

export interface SaleStats {
  totalSales: number;
}

// localStorageキャッシュ（10分間有効）
const CACHE_DURATION_MS = 10 * 60 * 1000;
const CACHE_KEY_ASP = 'header_asp_stats';
const CACHE_KEY_SALES = 'header_sale_stats';

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed: CachedData<T> = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheEntry: CachedData<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch {
    // localStorage full or disabled
  }
}

interface UseHeaderStatsOptions {
  filterFanzaOnly?: boolean;
}

interface UseHeaderStatsResult {
  aspStats: AspStat[];
  saleStats: SaleStats | null;
  filteredAspStats: AspStat[];
  skeletonWidths: number[];
}

export function useHeaderStats(options: UseHeaderStatsOptions = {}): UseHeaderStatsResult {
  const { filterFanzaOnly = false } = options;
  const [aspStats, setAspStats] = useState<AspStat[]>([]);
  const [saleStats, setSaleStats] = useState<SaleStats | null>(null);

  useEffect(() => {
    // キャッシュから即座に復元
    const cachedAsp = getCachedData<AspStat[]>(CACHE_KEY_ASP);
    const cachedSales = getCachedData<SaleStats>(CACHE_KEY_SALES);

    if (cachedAsp) {
      setAspStats(cachedAsp);
    }
    if (cachedSales) {
      setSaleStats(cachedSales);
    }

    // バックグラウンドで最新データを取得
    fetch('/api/stats/asp')
      .then(res => res.json())
      .then(data => {
        setAspStats(data);
        setCachedData(CACHE_KEY_ASP, data);
      })
      .catch(() => {
        if (!cachedAsp) setAspStats([]);
      });

    fetch('/api/stats/sales')
      .then(res => res.json())
      .then(data => {
        setSaleStats(data);
        setCachedData(CACHE_KEY_SALES, data);
      })
      .catch(() => {
        if (!cachedSales) setSaleStats(null);
      });
  }, []);

  // Filter ASP stats based on site mode
  const filteredAspStats = filterFanzaOnly
    ? aspStats.filter(s => s.aspName === 'FANZA')
    : aspStats.filter(s => s.aspName !== 'FANZA');

  const skeletonWidths = filterFanzaOnly ? [80] : [80, 90, 70, 65, 70, 60, 65, 60];

  return {
    aspStats,
    saleStats,
    filteredAspStats,
    skeletonWidths,
  };
}

// Header用翻訳（ConditionalLayoutはNextIntlClientProvider外にあるため）
export const headerTranslations = {
  ja: {
    subtitle: 'heavy user guide',
    products: '作品一覧',
    actresses: '女優一覧',
    favorites: 'お気に入り',
    menu: 'メニュー',
    sale: 'SALE',
    saleItems: '件セール中',
    adultNotice: '※このページは成人向けコンテンツを含みます。表示価格は税込みです。販売サイトにより価格が異なる場合がありますので、購入前に各サイトで最新価格をご確認ください。',
  },
  en: {
    subtitle: 'heavy user guide',
    products: 'Products',
    actresses: 'Actresses',
    favorites: 'Favorites',
    menu: 'Menu',
    sale: 'SALE',
    saleItems: 'items on sale',
    adultNotice: '※This page contains adult content. Prices shown include tax. Prices may vary by retailer, so please check the latest prices on each site before purchasing.',
  },
  zh: {
    subtitle: 'heavy user guide',
    products: '作品列表',
    actresses: '女优列表',
    favorites: '收藏',
    menu: '菜单',
    sale: 'SALE',
    saleItems: '件特卖中',
    adultNotice: '※本页面包含成人内容。显示价格含税。价格可能因销售网站而异，请在购买前确认各网站的最新价格。',
  },
  ko: {
    subtitle: 'heavy user guide',
    products: '작품 목록',
    actresses: '배우 목록',
    favorites: '즐겨찾기',
    menu: '메뉴',
    sale: 'SALE',
    saleItems: '개 세일 중',
    adultNotice: '※이 페이지는 성인용 콘텐츠를 포함합니다. 표시 가격은 세금 포함입니다. 판매 사이트에 따라 가격이 다를 수 있으니 구매 전 각 사이트에서 최신 가격을 확인하세요.',
  },
} as const;

export type HeaderTranslationKey = keyof typeof headerTranslations;
export type HeaderTranslation = typeof headerTranslations[HeaderTranslationKey];
