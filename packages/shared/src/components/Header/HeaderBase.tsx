'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, memo, useCallback, useMemo, type ReactNode, type ComponentType } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { providerMeta } from '../../lib/providers';
import {
  headerTranslations,
  useSaleStats,
  type SaleStats,
  type HeaderTranslation,
} from '../../lib/hooks/useHeaderStats';
import { localizedHref, locales, defaultLocale, type Locale } from '../../i18n';
import { ASP_DISPLAY_ORDER, ASP_TO_PROVIDER_ID } from '../../constants/filters';

// FANZAサイトへのリンク用URL
const FANZA_SITE_URL = 'https://www.f.adult-v.com';

// Memoized ASP Badge List to prevent re-renders
interface AspBadgeListProps {
  aspList: { aspName: string; providerId: string }[];
  saleStats: SaleStats | null;
  locale: string;
  saleLabel: string;
  /** 現在のパス（FANZAリンクでコンテキストを保持するため） */
  currentPath?: string;
  onLinkClick?: () => void;
}

const AspBadgeList = memo(function AspBadgeList({
  aspList,
  saleStats,
  locale,
  saleLabel,
  currentPath,
  onLinkClick,
}: AspBadgeListProps) {
  return (
    <>
      {/* セールバッジ */}
      {saleStats === null ? (
        <div className="asp-badge asp-badge-skeleton" />
      ) : saleStats.totalSales > 0 ? (
        <Link
          href={localizedHref('/products?onSale=true', locale)}
          className="asp-badge asp-badge-sale"
          {...(onLinkClick && { onClick: onLinkClick })}
        >
          <span className="font-bold">{saleLabel}</span>
          <span className="ml-1 opacity-90">{saleStats.totalSales.toLocaleString()}</span>
        </Link>
      ) : null}
      {/* ASPリンク - 内部フィルター（FANZAはヘッダーから除外済み） */}
      {aspList.map((asp) => {
        const meta = providerMeta[asp.providerId as keyof typeof providerMeta];
        const colors = meta?.gradientColors || { from: '#4b5563', to: '#374151' };

        return (
          <Link
            key={asp.aspName}
            href={localizedHref(`/products?includeAsp=${asp.aspName}`, locale)}
            className="asp-badge"
            style={{ background: `linear-gradient(to right, ${colors.from}, ${colors.to})` }}
            {...(onLinkClick && { onClick: onLinkClick })}
          >
            <span className="font-bold">{meta?.label || asp.aspName}</span>
          </Link>
        );
      })}
    </>
  );
});

// SVGアイコンコンポーネント
const ProductsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ActressesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const DiaryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
  </svg>
);

const ProfileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

const FavoritesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
      clipRule="evenodd"
    />
  </svg>
);

const WatchlistIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path
      fillRule="evenodd"
      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
      clipRule="evenodd"
    />
  </svg>
);

const CompareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
  </svg>
);

const StatisticsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
      clipRule="evenodd"
    />
  </svg>
);

const DiscoverIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
  </svg>
);

const CategoriesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="ml-0.5 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

// ドロップダウンメニューコンポーネント
interface DropdownMenuProps {
  label: string;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const DropdownMenu = memo(function DropdownMenu({ label, children, isOpen, onToggle, onClose }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={onToggle}
        className="theme-nav-link flex items-center rounded px-2 py-1 text-sm font-medium transition-colors hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <div className="theme-dropdown theme-border absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-lg border py-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
});

const MenuIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {isOpen ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    )}
  </svg>
);

export interface HeaderBaseProps {
  /** SearchBarコンポーネント */
  SearchBar: ComponentType;
  /** LanguageSwitcherコンポーネント */
  LanguageSwitcher: ComponentType;
  /** NotificationSubscriberコンポーネント */
  NotificationSubscriber: ComponentType;
  /** UserMenuコンポーネント（ログイン/アバター表示） */
  UserMenu: ComponentType<{ locale: string }>;
  /** FANZAサイトかどうか */
  isFanzaSite: boolean;
  /** ロゴをカスタマイズする場合 */
  renderLogo?: (locale: string, t: HeaderTranslation) => ReactNode;
}

/**
 * 共有Headerベースコンポーネント
 * 言語取得は?hl=パラメータから統一的に行う
 */
export const HeaderBase = memo(function HeaderBase({
  SearchBar,
  LanguageSwitcher,
  NotificationSubscriber,
  UserMenu,
  isFanzaSite,
  renderLogo,
}: HeaderBaseProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'browse' | 'tools' | 'my' | 'community' | null>(null);
  const lastScrollY = useRef(0);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  // ドロップダウン制御
  const handleDropdownToggle = useCallback((menu: 'browse' | 'tools' | 'my' | 'community') => {
    setOpenDropdown((prev) => (prev === menu ? null : menu));
  }, []);

  const handleDropdownClose = useCallback(() => {
    setOpenDropdown(null);
  }, []);

  // ?hl= パラメータから現在の言語を取得
  const hlParam = searchParams.get('hl');
  const locale = (hlParam && locales.includes(hlParam as Locale) ? hlParam : defaultLocale) as string;
  const t = headerTranslations[locale as keyof typeof headerTranslations] || headerTranslations.ja;

  // セール統計のみ取得（ASP統計は静的リストを使用）
  const { saleStats } = useSaleStats();

  // 静的ASPリスト - useMemoでメモ化
  // FANZAサイトでは空リスト、adult-vサイトではFANZAを除外した全ASPを表示
  // FANZAはヘッダーではなく各ページ（女優、商品）で専用リンクとして表示
  const aspList = useMemo(() => {
    if (isFanzaSite) return [];
    return ASP_DISPLAY_ORDER.filter((aspName) => aspName !== 'fanza') // FANZAはヘッダーから除外
      .map((aspName) => ({
        aspName,
        providerId: ASP_TO_PROVIDER_ID[aspName] ?? 'duga',
      }));
  }, [isFanzaSite]);

  // Memoized callback for closing mobile menu with focus restoration
  const handleMobileMenuClose = useCallback(() => {
    setIsMobileMenuOpen(false);
    // フォーカスをメニューボタンに戻す
    menuButtonRef.current?.focus();
  }, []);

  // エスケープキーでモバイルメニューを閉じる + フォーカストラップ
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const menu = mobileMenuRef.current;
    if (!menu) return;

    // メニューが開いている間、背景スクロールを防止
    document.body.style.overflow = 'hidden';

    // フォーカス可能な要素を取得
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 初期フォーカスを最初の要素に移動
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleMobileMenuClose();
        return;
      }

      // フォーカストラップ
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen, handleMobileMenuClose]);

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

  // デフォルトロゴ
  const defaultLogo = (
    <Link href={localizedHref('/', locale)} className="header-logo flex shrink-0 items-center space-x-2">
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
          <span className="theme-logo-subtitle hidden text-xs tracking-widest uppercase sm:inline">{t.subtitle}</span>
        </>
      )}
    </Link>
  );

  return (
    <header
      className={`theme-header sticky top-0 z-50 border-b transition-transform duration-300 ${
        isHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* 広告表記・成人向けコンテンツ注意文（景品表示法・ステマ規制対応） */}
      <div className="theme-header-notice border-b">
        <div className="container mx-auto px-3 py-1 sm:px-4">
          <p className="theme-header-notice-text text-center text-[10px] leading-tight sm:text-xs">
            <span className="mr-1 rounded bg-yellow-900/30 px-1 font-bold text-yellow-400">PR</span>
            {t.adultNotice.replace(/^【PR】|^\[PR\]|^【广告】/, '')}
          </p>
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-4">
          {/* ロゴ */}
          {renderLogo ? renderLogo(locale, t) : defaultLogo}

          {/* 検索バー（デスクトップ） */}
          <div className="hidden max-w-md flex-1 md:block">
            <SearchBar />
          </div>

          {/* デスクトップナビゲーション - ドロップダウンメニュー形式 */}
          <nav className="theme-nav ml-auto hidden shrink-0 items-center gap-1 md:flex">
            {/* コンテンツメニュー */}
            <DropdownMenu
              label={t.menuBrowse}
              isOpen={openDropdown === 'browse'}
              onToggle={() => handleDropdownToggle('browse')}
              onClose={handleDropdownClose}
            >
              <Link
                href={localizedHref('/', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <ActressesIcon />
                {t.actresses}
              </Link>
              <Link
                href={localizedHref('/products', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <ProductsIcon />
                {t.products}
              </Link>
              <Link
                href={localizedHref('/categories', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <CategoriesIcon />
                {t.categories}
              </Link>
              <Link
                href={localizedHref('/calendar', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <CalendarIcon />
                {t.calendar}
              </Link>
              <Link
                href={localizedHref('/discover', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <DiscoverIcon />
                {t.discover}
              </Link>
              {!isFanzaSite && (
                <>
                  <div className="theme-border my-1 border-t" />
                  <Link
                    href={localizedHref('/daily-pick', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.dailyPick}
                  </Link>
                  <Link
                    href={localizedHref('/weekly-report', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.weeklyTrends}
                  </Link>
                  <Link
                    href={localizedHref('/hidden-gems', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.hiddenGems}
                  </Link>
                  <Link
                    href={localizedHref('/rookies', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.rookies}
                  </Link>
                  <div className="theme-border my-1 border-t" />
                  <Link
                    href={localizedHref('/sales', locale)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-orange-400 hover:bg-orange-500/20"
                    onClick={handleDropdownClose}
                  >
                    <span className="text-lg">🔥</span>
                    {t.sales}
                  </Link>
                </>
              )}
            </DropdownMenu>

            {/* ツールメニュー */}
            <DropdownMenu
              label={t.menuTools}
              isOpen={openDropdown === 'tools'}
              onToggle={() => handleDropdownToggle('tools')}
              onClose={handleDropdownClose}
            >
              <Link
                href={localizedHref('/statistics', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <StatisticsIcon />
                {t.statistics}
              </Link>
              <Link
                href={localizedHref('/compare', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <CompareIcon />
                {t.compare}
              </Link>
              <Link
                href={localizedHref('/profile', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                <ProfileIcon />
                {t.profile}
              </Link>
            </DropdownMenu>

            {/* コミュニティメニュー */}
            <DropdownMenu
              label={t.menuCommunity}
              isOpen={openDropdown === 'community'}
              onToggle={() => handleDropdownToggle('community')}
              onClose={handleDropdownClose}
            >
              <Link
                href={localizedHref('/lists', locale)}
                className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                onClick={handleDropdownClose}
              >
                {t.publicLists}
              </Link>
              {!isFanzaSite && (
                <>
                  <Link
                    href={localizedHref('/lists/ranking', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.listRanking}
                  </Link>
                  <Link
                    href={localizedHref('/reviewers', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.reviewers}
                  </Link>
                  <Link
                    href={localizedHref('/vote', locale)}
                    className="theme-dropdown-item flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handleDropdownClose}
                  >
                    {t.voteRanking}
                  </Link>
                </>
              )}
            </DropdownMenu>

            {/* 通知・言語切り替え・ユーザーメニュー */}
            <div className="ml-2 flex items-center gap-2">
              <NotificationSubscriber />
              <LanguageSwitcher />
              <UserMenu locale={locale} />
            </div>
          </nav>

          {/* モバイル検索 + メニューボタン */}
          <div className="flex items-center md:hidden">
            <button
              className="flex min-h-[48px] min-w-[48px] items-center justify-center p-2"
              onClick={() => {
                setIsMobileMenuOpen(true);
              }}
              aria-label={t.search}
            >
              <svg className="theme-text h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            <button
              ref={menuButtonRef}
              className="-mr-2 flex min-h-[48px] min-w-[48px] items-center justify-center p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? t.closeMenu : t.menu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <MenuIcon isOpen={isMobileMenuOpen} />
            </button>
          </div>
        </div>

        {/* モバイルメニュー（検索バー・ナビ・ASP統計を格納） */}
        {isMobileMenuOpen && (
          <nav
            ref={mobileMenuRef}
            id="mobile-menu"
            className="theme-border max-h-[calc(100dvh-100px)] space-y-1 overflow-y-auto border-t py-3 md:hidden"
            role="navigation"
            aria-label={t.mobileNav}
          >
            {/* 検索バー */}
            <div className="pb-2">
              <SearchBar />
            </div>

            {/* コンテンツ */}
            <div className="theme-nav">
              <p className="theme-text-muted px-1 py-1 text-xs font-semibold tracking-wider uppercase">
                {t.menuBrowse}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0" role="list">
                <Link
                  href={localizedHref('/', locale)}
                  className="theme-nav-actresses flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <ActressesIcon />
                  <span className="ml-2">{t.actresses}</span>
                </Link>
                <Link
                  href={localizedHref('/products', locale)}
                  className="theme-nav-products flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <ProductsIcon />
                  <span className="ml-2">{t.products}</span>
                </Link>
                <Link
                  href={localizedHref('/categories', locale)}
                  className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <CategoriesIcon />
                  <span className="ml-2">{t.categories}</span>
                </Link>
                <Link
                  href={localizedHref('/calendar', locale)}
                  className="theme-nav-calendar flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <CalendarIcon />
                  <span className="ml-2">{t.calendar}</span>
                </Link>
                <Link
                  href={localizedHref('/discover', locale)}
                  className="theme-nav-discover flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <DiscoverIcon />
                  <span className="ml-2">{t.discover}</span>
                </Link>
                {!isFanzaSite && (
                  <>
                    <Link
                      href={localizedHref('/daily-pick', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.dailyPick}</span>
                    </Link>
                    <Link
                      href={localizedHref('/weekly-report', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.weeklyTrends}</span>
                    </Link>
                    <Link
                      href={localizedHref('/hidden-gems', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.hiddenGems}</span>
                    </Link>
                    <Link
                      href={localizedHref('/rookies', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.rookies}</span>
                    </Link>
                    <Link
                      href={localizedHref('/sales', locale)}
                      className="col-span-2 flex min-h-[44px] items-center py-2.5 text-sm font-bold text-orange-400 transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="mr-2 text-lg">🔥</span>
                      {t.onSaleProducts}
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* ツール */}
            <div className="theme-nav theme-border border-t pt-2">
              <p className="theme-text-muted px-1 py-1 text-xs font-semibold tracking-wider uppercase">{t.menuTools}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0" role="list">
                <Link
                  href={localizedHref('/statistics', locale)}
                  className="theme-nav-statistics flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <StatisticsIcon />
                  <span className="ml-2">{t.statistics}</span>
                </Link>
                <Link
                  href={localizedHref('/compare', locale)}
                  className="theme-nav-compare flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <CompareIcon />
                  <span className="ml-2">{t.compare}</span>
                </Link>
                <Link
                  href={localizedHref('/profile', locale)}
                  className="theme-nav-profile flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <ProfileIcon />
                  <span className="ml-2">{t.profile}</span>
                </Link>
              </div>
            </div>

            {/* コミュニティ */}
            <div className="theme-nav theme-border border-t pt-2">
              <p className="theme-text-muted px-1 py-1 text-xs font-semibold tracking-wider uppercase">
                {t.menuCommunity}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0" role="list">
                <Link
                  href={localizedHref('/lists', locale)}
                  className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                  onClick={handleMobileMenuClose}
                  role="listitem"
                >
                  <span className="ml-6">{t.publicLists}</span>
                </Link>
                {!isFanzaSite && (
                  <>
                    <Link
                      href={localizedHref('/lists/ranking', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.listRanking}</span>
                    </Link>
                    <Link
                      href={localizedHref('/reviewers', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.reviewers}</span>
                    </Link>
                    <Link
                      href={localizedHref('/vote', locale)}
                      className="theme-nav-link flex min-h-[44px] items-center py-2.5 text-sm transition-colors"
                      onClick={handleMobileMenuClose}
                      role="listitem"
                    >
                      <span className="ml-6">{t.voteRanking}</span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* 通知・言語切り替え・ユーザーメニュー */}
            <div className="flex items-center gap-4 py-2">
              <NotificationSubscriber />
              <LanguageSwitcher />
              <UserMenu locale={locale} />
            </div>

            {/* ASPリンク（モバイル用） */}
            <div className="theme-border border-t pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <AspBadgeList
                  aspList={aspList}
                  saleStats={saleStats}
                  locale={locale}
                  saleLabel={t.sale}
                  currentPath={pathname}
                  onLinkClick={handleMobileMenuClose}
                />
              </div>
            </div>
          </nav>
        )}
      </div>

      {/* ASPリンクバー - デスクトップのみ表示 */}
      <div className="theme-asp-bar hidden border-t md:block">
        <div className="container mx-auto px-4">
          <div className="flex min-h-[36px] flex-wrap items-center gap-2 py-1.5">
            <AspBadgeList
              aspList={aspList}
              saleStats={saleStats}
              locale={locale}
              saleLabel={t.sale}
              currentPath={pathname}
            />
          </div>
        </div>
      </div>
    </header>
  );
});

export default HeaderBase;
