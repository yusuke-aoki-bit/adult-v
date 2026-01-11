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
    watchlist: 'あとで見る',
    compare: '比較',
    statistics: '統計',
    calendar: 'カレンダー',
    discover: '発見',
    categories: 'カテゴリ',
    menu: 'メニュー',
    closeMenu: 'メニューを閉じる',
    mobileNav: 'モバイルナビゲーション',
    sale: 'SALE',
    saleItems: '件セール中',
    fanzaSite: 'FANZA専用',
    adultNotice: '【PR】当サイトはアフィリエイト広告を利用しています。※成人向けコンテンツを含みます。価格は販売サイトにより異なる場合があります。',
    // ドロップダウンメニュー
    menuBrowse: 'コンテンツ',
    menuTools: 'ツール',
    menuMy: 'マイページ',
    menuCommunity: 'コミュニティ',
    // 追加メニュー項目
    dailyPick: '今日の1本',
    weeklyTrends: '週間トレンド',
    hiddenGems: '隠れた名作',
    rookies: '新人デビュー',
    birthdays: '誕生日',
    annualBest: '年間ベスト',
    publicLists: '公開リスト',
    listRanking: 'リストランキング',
    reviewers: 'レビュアー',
    voteRanking: '投票ランキング',
  },
  en: {
    subtitle: 'heavy user guide',
    products: 'Products',
    actresses: 'Actresses',
    diary: 'Diary',
    profile: 'DNA',
    favorites: 'Favorites',
    watchlist: 'Watch Later',
    compare: 'Compare',
    statistics: 'Stats',
    calendar: 'Calendar',
    discover: 'Discover',
    categories: 'Categories',
    menu: 'Menu',
    closeMenu: 'Close menu',
    mobileNav: 'Mobile navigation',
    sale: 'SALE',
    saleItems: 'items on sale',
    fanzaSite: 'FANZA Site',
    adultNotice: '[PR] This site uses affiliate advertising. *Contains adult content. Prices may vary by retailer.',
    // Dropdown menus
    menuBrowse: 'Browse',
    menuTools: 'Tools',
    menuMy: 'My Page',
    menuCommunity: 'Community',
    // Additional menu items
    dailyPick: "Today's Pick",
    weeklyTrends: 'Weekly Trends',
    hiddenGems: 'Hidden Gems',
    rookies: 'Rookies',
    birthdays: 'Birthdays',
    annualBest: 'Annual Best',
    publicLists: 'Public Lists',
    listRanking: 'List Rankings',
    reviewers: 'Reviewers',
    voteRanking: 'Vote Rankings',
  },
  zh: {
    subtitle: 'heavy user guide',
    products: '作品列表',
    actresses: '女优列表',
    diary: '观看日记',
    profile: 'DNA分析',
    favorites: '收藏',
    watchlist: '稍后观看',
    compare: '比较',
    statistics: '统计',
    calendar: '日历',
    discover: '发现',
    categories: '分类',
    menu: '菜单',
    closeMenu: '关闭菜单',
    mobileNav: '移动导航',
    sale: 'SALE',
    saleItems: '件特卖中',
    fanzaSite: 'FANZA专区',
    adultNotice: '【广告】本站使用联盟广告。※包含成人内容。价格可能因销售网站而异。',
    // 下拉菜单
    menuBrowse: '浏览',
    menuTools: '工具',
    menuMy: '我的',
    menuCommunity: '社区',
    // 附加菜单项
    dailyPick: '今日推荐',
    weeklyTrends: '周趋势',
    hiddenGems: '隐藏宝藏',
    rookies: '新人出道',
    birthdays: '生日',
    annualBest: '年度最佳',
    publicLists: '公开列表',
    listRanking: '列表排名',
    reviewers: '评论者',
    voteRanking: '投票排名',
  },
  ko: {
    subtitle: 'heavy user guide',
    products: '작품 목록',
    actresses: '배우 목록',
    diary: '시청 일기',
    profile: 'DNA분석',
    favorites: '즐겨찾기',
    watchlist: '나중에 보기',
    compare: '비교',
    statistics: '통계',
    calendar: '캘린더',
    discover: '발견',
    categories: '카테고리',
    menu: '메뉴',
    closeMenu: '메뉴 닫기',
    mobileNav: '모바일 내비게이션',
    sale: 'SALE',
    saleItems: '개 세일 중',
    fanzaSite: 'FANZA 전용',
    adultNotice: '【PR】이 사이트는 제휴 광고를 사용합니다. ※성인용 콘텐츠를 포함합니다. 판매 사이트에 따라 가격이 다를 수 있습니다.',
    // 드롭다운 메뉴
    menuBrowse: '둘러보기',
    menuTools: '도구',
    menuMy: '마이페이지',
    menuCommunity: '커뮤니티',
    // 추가 메뉴 항목
    dailyPick: '오늘의 추천',
    weeklyTrends: '주간 트렌드',
    hiddenGems: '숨은 명작',
    rookies: '신인 데뷔',
    birthdays: '생일',
    annualBest: '연간 베스트',
    publicLists: '공개 리스트',
    listRanking: '리스트 랭킹',
    reviewers: '리뷰어',
    voteRanking: '투표 랭킹',
  },
} as const;

export type HeaderTranslationKey = keyof typeof headerTranslations;
export type HeaderTranslation = typeof headerTranslations[HeaderTranslationKey];
