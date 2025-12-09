'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationSubscriber from './NotificationSubscriber';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

interface AspStat {
  aspName: string;
  productCount: number;
  actressCount: number;
  estimatedTotal: number | null;
}

interface SaleStats {
  totalSales: number;
}

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
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

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aspStats, setAspStats] = useState<AspStat[]>([]);
  const [saleStats, setSaleStats] = useState<SaleStats | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  // スクロール時にヘッダーを自動非表示/表示
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // 100px以上スクロールしてから動作開始（ちらつき防止）
      if (currentScrollY < 100) {
        setIsHidden(false);
      } else if (scrollDelta > 10) {
        // 下スクロール: 非表示
        setIsHidden(true);
      } else if (scrollDelta < -10) {
        // 上スクロール: 表示
        setIsHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/stats/asp')
      .then(res => res.json())
      .then(data => setAspStats(data))
      .catch(() => setAspStats([]));

    fetch('/api/stats/sales')
      .then(res => res.json())
      .then(data => setSaleStats(data))
      .catch(() => setSaleStats(null));
  }, []);

  return (
    <header
      className={`bg-gray-950 text-white border-b border-white/10 sticky top-0 z-50 transition-transform duration-300 ${
        isHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* 成人向けコンテンツ注意文 */}
      <div className="bg-gray-800/80 border-b border-white/5">
        <div className="container mx-auto px-3 sm:px-4 py-1">
          <p className="text-[10px] sm:text-xs text-gray-300 text-center leading-tight">
            {t.adultNotice}
          </p>
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* ロゴ */}
          <Link href={`/${locale}`} className="flex items-center space-x-2 flex-shrink-0">
            <div className="text-2xl font-bold tracking-tight">
              <span className="text-rose-400">ADULT</span>
              <span className="text-white">VIEWER LAB</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-white/70 hidden sm:inline">
              {t.subtitle}
            </span>
          </Link>

          {/* 検索バー（デスクトップ） */}
          <div className="hidden md:block flex-1 max-w-md">
            <SearchBar />
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-3 flex-shrink-0">
            <Link
              href={`/${locale}/products`}
              className="hover:text-purple-300 transition-colors font-medium flex items-center gap-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {t.products}
            </Link>
            <Link
              href={`/${locale}`}
              className="hover:text-pink-300 transition-colors font-medium flex items-center gap-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              {t.actresses}
            </Link>
            <NotificationSubscriber />
            <Link
              href={`/${locale}/favorites`}
              className="hover:text-rose-300 transition-colors font-medium flex items-center gap-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              {t.favorites}
            </Link>
            <LanguageSwitcher />
          </nav>

          {/* モバイルメニューボタン */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={t.menu}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* 検索バー（モバイル） */}
        <div className="md:hidden w-full pb-4">
          <SearchBar />
        </div>

        {/* モバイルメニュー */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 space-y-4">
            <Link
              href={`/${locale}/products`}
              className="block py-2 hover:text-purple-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t.products}
            </Link>
            <Link
              href={`/${locale}`}
              className="block py-2 hover:text-pink-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t.actresses}
            </Link>
            <div className="py-2">
              <NotificationSubscriber />
            </div>
            <Link
              href={`/${locale}/favorites`}
              className="block py-2 hover:text-rose-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t.favorites}
            </Link>
            <div className="py-2">
              <LanguageSwitcher />
            </div>
          </nav>
        )}
      </div>

      {/* ASP統計バー - ヘッダー下部に統合 */}
      <div className="bg-gray-900/80 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-1.5 flex-wrap min-h-[36px]">
            {/* セールバッジ */}
            {saleStats === null ? (
              <div className="px-2 py-1 rounded bg-gray-700 text-transparent text-[11px] font-medium h-[24px] w-[100px] animate-pulse flex-shrink-0" />
            ) : saleStats.totalSales > 0 ? (
              <Link
                href={`/${locale}/products?onSale=true`}
                className="px-2 py-1 rounded bg-gradient-to-r from-red-600 to-red-500 text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center flex-shrink-0 animate-pulse"
              >
                <span className="font-bold">{t.sale}</span>
                <span className="ml-1 opacity-90">{saleStats.totalSales.toLocaleString()}</span>
              </Link>
            ) : null}
            {/* ASP統計バッジ */}
            {aspStats.length === 0 ? (
              <>
                {[80, 70, 65, 70, 60, 65, 60].map((width, i) => (
                  <div key={i} className="px-2 py-1 rounded bg-gray-700 text-transparent text-[11px] font-medium h-[24px] animate-pulse flex-shrink-0" style={{ width: `${width}px` }} />
                ))}
              </>
            ) : (
              aspStats.map((stat) => {
                const providerId = ASP_TO_PROVIDER_ID[stat.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                return (
                  <Link
                    key={stat.aspName}
                    href={`/${locale}/products?includeAsp=${stat.aspName}`}
                    className={`px-2 py-1 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center flex-shrink-0`}
                  >
                    <span className="font-bold">{meta?.label || stat.aspName}</span>
                    <span className="ml-1 opacity-80">{stat.productCount.toLocaleString()}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
