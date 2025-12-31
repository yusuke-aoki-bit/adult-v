'use client';

import { useState, useEffect } from 'react';

export interface SaleStats {
  totalSales: number;
}

// localStorageキャッシュ（10分間有効）
const CACHE_DURATION_MS = 10 * 60 * 1000;
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

interface UseSaleStatsResult {
  saleStats: SaleStats | null;
}

/**
 * セール統計のみを取得するフック
 * ASP統計は静的リストを使用するため、このフックはセール件数のみを取得
 */
export function useSaleStats(): UseSaleStatsResult {
  const [saleStats, setSaleStats] = useState<SaleStats | null>(null);

  useEffect(() => {
    // キャッシュから即座に復元
    const cachedSales = getCachedData<SaleStats>(CACHE_KEY_SALES);

    if (cachedSales) {
      setSaleStats(cachedSales);
      return; // キャッシュがあれば終了
    }

    // キャッシュがない場合はAPIからフェッチ
    fetch('/api/stats/sales')
      .then(res => res.json())
      .then(data => {
        // APIレスポンスにtotalSalesがあることを確認
        if (data && typeof data.totalSales === 'number') {
          setSaleStats({ totalSales: data.totalSales });
          setCachedData(CACHE_KEY_SALES, { totalSales: data.totalSales });
        }
      })
      .catch(() => {
        // エラー時は空の状態を設定（スケルトン表示のまま）
      });
  }, []);

  return { saleStats };
}

// Header用翻訳（ConditionalLayoutはNextIntlClientProvider外にあるため）
export const headerTranslations = {
  ja: {
    subtitle: 'heavy user guide',
    products: '作品一覧',
    actresses: '女優一覧',
    diary: '視聴日記',
    profile: 'DNA分析',
    favorites: 'お気に入り',
    statistics: '統計',
    calendar: 'カレンダー',
    menu: 'メニュー',
    closeMenu: 'メニューを閉じる',
    mobileNav: 'モバイルナビゲーション',
    sale: 'SALE',
    saleItems: '件セール中',
    fanzaSite: 'FANZA専用',
    adultNotice: '※このページは成人向けコンテンツを含みます。表示価格は税込みです。販売サイトにより価格が異なる場合がありますので、購入前に各サイトで最新価格をご確認ください。',
  },
  en: {
    subtitle: 'heavy user guide',
    products: 'Products',
    actresses: 'Actresses',
    diary: 'Diary',
    profile: 'DNA',
    favorites: 'Favorites',
    statistics: 'Stats',
    calendar: 'Calendar',
    menu: 'Menu',
    closeMenu: 'Close menu',
    mobileNav: 'Mobile navigation',
    sale: 'SALE',
    saleItems: 'items on sale',
    fanzaSite: 'FANZA Site',
    adultNotice: '※This page contains adult content. Prices shown include tax. Prices may vary by retailer, so please check the latest prices on each site before purchasing.',
  },
  zh: {
    subtitle: 'heavy user guide',
    products: '作品列表',
    actresses: '女优列表',
    diary: '观看日记',
    profile: 'DNA分析',
    favorites: '收藏',
    statistics: '统计',
    calendar: '日历',
    menu: '菜单',
    closeMenu: '关闭菜单',
    mobileNav: '移动导航',
    sale: 'SALE',
    saleItems: '件特卖中',
    fanzaSite: 'FANZA专区',
    adultNotice: '※本页面包含成人内容。显示价格含税。价格可能因销售网站而异，请在购买前确认各网站的最新价格。',
  },
  ko: {
    subtitle: 'heavy user guide',
    products: '작품 목록',
    actresses: '배우 목록',
    diary: '시청 일기',
    profile: 'DNA분석',
    favorites: '즐겨찾기',
    statistics: '통계',
    calendar: '캘린더',
    menu: '메뉴',
    closeMenu: '메뉴 닫기',
    mobileNav: '모바일 내비게이션',
    sale: 'SALE',
    saleItems: '개 세일 중',
    fanzaSite: 'FANZA 전용',
    adultNotice: '※이 페이지는 성인용 콘텐츠를 포함합니다. 표시 가격은 세금 포함입니다. 판매 사이트에 따라 가격이 다를 수 있으니 구매 전 각 사이트에서 최신 가격을 확인하세요.',
  },
} as const;

export type HeaderTranslationKey = keyof typeof headerTranslations;
export type HeaderTranslation = typeof headerTranslations[HeaderTranslationKey];
