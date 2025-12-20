'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationSubscriber from './NotificationSubscriber';
import { providerMeta } from '@/lib/providers';
import { useSite } from '@/lib/contexts/SiteContext';
import { useSaleStats, headerTranslations } from '@/lib/hooks/useHeaderStats';
import { localizedHref } from '@adult-v/shared/i18n';
import { locales, defaultLocale, type Locale } from '@/i18n';
import { ASP_DISPLAY_ORDER, ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

// 静的ASPリスト（ASP_DISPLAY_ORDERに基づく統一された順序）
const STATIC_ASP_LIST = ASP_DISPLAY_ORDER.map(aspName => ({
  aspName,
  providerId: ASP_TO_PROVIDER_ID[aspName] ?? 'duga',
}));

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const searchParams = useSearchParams();

  // ?hl= パラメータから現在の言語を取得
  const hlParam = searchParams.get('hl');
  const locale = (hlParam && locales.includes(hlParam as Locale) ? hlParam : defaultLocale) as string;
  const t = headerTranslations[locale as keyof typeof headerTranslations] || headerTranslations.ja;
  const { isFanzaSite } = useSite();

  // セール統計のみ取得（ASP統計は静的リストを使用）
  const { saleStats } = useSaleStats();

  // FANZAサイトの場合はASPリストを非表示
  const aspList = isFanzaSite ? [] : STATIC_ASP_LIST;

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

  return (
    <header
      className={`theme-header border-b sticky top-0 z-50 transition-transform duration-300 ${
        isHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* 成人向けコンテンツ注意文 */}
      <div className="theme-header-notice border-b">
        <div className="container mx-auto px-3 sm:px-4 py-1">
          <p className="text-[10px] sm:text-xs theme-header-notice-text text-center leading-tight">
            {t.adultNotice}
          </p>
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* ロゴ */}
          <Link href={localizedHref('/', locale)} className="flex items-center space-x-2 flex-shrink-0">
            {isFanzaSite ? (
              <div className="text-2xl font-bold tracking-tight">
                <span className="theme-logo-primary">FANZA</span>
                <span className="theme-logo-secondary"> Reviews</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">
                  <span className="theme-logo-primary">ADULT</span>
                  <span className="theme-logo-secondary">VIEWER LAB</span>
                </div>
                <span className="text-xs uppercase tracking-widest theme-logo-subtitle hidden sm:inline">
                  {t.subtitle}
                </span>
              </>
            )}
          </Link>

          {/* 検索バー（デスクトップ） */}
          <div className="hidden md:block flex-1 max-w-md">
            <SearchBar />
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-3 flex-shrink-0 theme-nav">
            <Link
              href={localizedHref('/products', locale)}
              className="theme-nav-products transition-colors font-medium flex items-center gap-1 text-sm"
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
              href={localizedHref('/', locale)}
              className="theme-nav-actresses transition-colors font-medium flex items-center gap-1 text-sm"
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
              href={localizedHref('/diary', locale)}
              className="theme-nav-diary transition-colors font-medium flex items-center gap-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              {t.diary}
            </Link>
            <Link
              href={localizedHref('/profile', locale)}
              className="theme-nav-profile transition-colors font-medium flex items-center gap-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {t.profile}
            </Link>
            <Link
              href={localizedHref('/favorites', locale)}
              className="theme-nav-favorites transition-colors font-medium flex items-center gap-1 text-sm"
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

        {/* モバイルメニュー（検索バー・ナビ・ASP統計を格納） */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-3 space-y-1 border-t theme-border max-h-[calc(100dvh-100px)] overflow-y-auto">
            {/* 検索バー */}
            <div className="pb-2">
              <SearchBar />
            </div>

            {/* ナビゲーションリンク - コンパクトに */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 theme-nav">
              <Link
                href={localizedHref('/products', locale)}
                className="py-1.5 theme-nav-products transition-colors text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.products}
              </Link>
              <Link
                href={localizedHref('/', locale)}
                className="py-1.5 theme-nav-actresses transition-colors text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.actresses}
              </Link>
              <Link
                href={localizedHref('/diary', locale)}
                className="py-1.5 theme-nav-diary transition-colors text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.diary}
              </Link>
              <Link
                href={localizedHref('/profile', locale)}
                className="py-1.5 theme-nav-profile transition-colors text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.profile}
              </Link>
              <Link
                href={localizedHref('/favorites', locale)}
                className="py-1.5 theme-nav-favorites transition-colors text-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t.favorites}
              </Link>
            </div>

            {/* 通知と言語切り替え */}
            <div className="flex items-center gap-4 py-2">
              <NotificationSubscriber />
              <LanguageSwitcher />
            </div>

            {/* ASPリンク（モバイル用） */}
            <div className="pt-2 border-t theme-border">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* セールバッジ */}
                {saleStats === null ? (
                  <div className="px-2 py-1 rounded theme-skeleton text-transparent text-[11px] font-medium h-[24px] w-[80px] animate-pulse shrink-0" />
                ) : saleStats.totalSales > 0 ? (
                  <Link
                    href={localizedHref('/products?onSale=true', locale)}
                    className="px-2 py-1 rounded bg-gradient-to-r from-red-600 to-red-500 text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center shrink-0 animate-pulse"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="font-bold">{t.sale}</span>
                    <span className="ml-1 opacity-90">{saleStats.totalSales.toLocaleString()}</span>
                  </Link>
                ) : null}
                {/* ASPリンク（件数なし） */}
                {aspList.map((asp) => {
                  const meta = providerMeta[asp.providerId];
                  return (
                    <Link
                      key={asp.aspName}
                      href={localizedHref(`/products?includeAsp=${asp.aspName}`, locale)}
                      className={`px-2 py-1 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center shrink-0`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="font-bold">{meta?.label || asp.aspName}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </div>

      {/* ASPリンクバー - デスクトップのみ表示 */}
      <div className="hidden md:block theme-asp-bar border-t">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-1.5 flex-wrap min-h-[36px]">
            {/* セールバッジ */}
            {saleStats === null ? (
              <div className="px-2 py-1 rounded theme-skeleton text-transparent text-[11px] font-medium h-[24px] w-[80px] animate-pulse shrink-0" />
            ) : saleStats.totalSales > 0 ? (
              <Link
                href={localizedHref('/products?onSale=true', locale)}
                className="px-2 py-1 rounded bg-gradient-to-r from-red-600 to-red-500 text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center shrink-0 animate-pulse"
              >
                <span className="font-bold">{t.sale}</span>
                <span className="ml-1 opacity-90">{saleStats.totalSales.toLocaleString()}</span>
              </Link>
            ) : null}
            {/* ASPリンク（件数なし） */}
            {aspList.map((asp) => {
              const meta = providerMeta[asp.providerId];
              return (
                <Link
                  key={asp.aspName}
                  href={localizedHref(`/products?includeAsp=${asp.aspName}`, locale)}
                  className={`px-2 py-1 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white text-[11px] font-medium hover:opacity-90 transition-opacity h-[24px] flex items-center shrink-0`}
                >
                  <span className="font-bold">{meta?.label || asp.aspName}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
