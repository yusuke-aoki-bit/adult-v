'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFirebaseAuth } from '../../contexts/FirebaseAuthContext';
import { localizedHref } from '../../i18n';

// SVG Icons
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const HeartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
  </svg>
);

const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
  </svg>
);

const CashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M6 10a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm4 1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

interface UserMenuTranslations {
  login: string;
  logout: string;
  favorites: string;
  watchlist: string;
  diary: string;
  lists: string;
  alerts: string;
  budget: string;
  saleCalendar: string;
  settings: string;
  anonymous: string;
}

const translations: Record<string, UserMenuTranslations> = {
  ja: {
    login: 'ログイン',
    logout: 'ログアウト',
    favorites: 'お気に入り',
    watchlist: 'あとで見る',
    diary: '視聴日記',
    lists: 'マイリスト',
    alerts: '価格アラート',
    budget: '予算管理',
    saleCalendar: 'セールカレンダー',
    settings: '設定',
    anonymous: 'ゲストユーザー',
  },
  en: {
    login: 'Login',
    logout: 'Logout',
    favorites: 'Favorites',
    watchlist: 'Watch Later',
    diary: 'Viewing Diary',
    lists: 'My Lists',
    alerts: 'Price Alerts',
    budget: 'Budget',
    saleCalendar: 'Sale Calendar',
    settings: 'Settings',
    anonymous: 'Guest User',
  },
  zh: {
    login: '登录',
    logout: '登出',
    favorites: '收藏',
    watchlist: '稍后观看',
    diary: '观看日记',
    lists: '我的列表',
    alerts: '价格提醒',
    budget: '预算管理',
    saleCalendar: '特卖日历',
    settings: '设置',
    anonymous: '游客用户',
  },
  ko: {
    login: '로그인',
    logout: '로그아웃',
    favorites: '즐겨찾기',
    watchlist: '나중에 보기',
    diary: '시청 일기',
    lists: '내 리스트',
    alerts: '가격 알림',
    budget: '예산 관리',
    saleCalendar: '세일 캘린더',
    settings: '설정',
    anonymous: '게스트 사용자',
  },
};

interface UserMenuProps {
  locale: string;
}

export function UserMenu({ locale }: UserMenuProps) {
  const { user, isLoading, isAuthenticated, linkGoogle, logout } = useFirebaseAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const t = translations[locale] || translations.ja;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await linkGoogle();
    } finally {
      setIsLoggingIn(false);
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
    );
  }

  // Not authenticated - show menu icon with limited options + login button
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        {/* Menu for public pages */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-2 z-50">
              <Link
                href={localizedHref('/lists', locale)}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ListIcon />
                {t.lists}
              </Link>
              <Link
                href={localizedHref('/sale-calendar', locale)}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <CalendarIcon />
                {t.saleCalendar}
              </Link>
              <Link
                href={localizedHref('/settings', locale)}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <SettingsIcon />
                {t.settings}
              </Link>
            </div>
          )}
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
        >
          {isLoggingIn ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span className="hidden sm:inline">{t.login}</span>
        </button>
      </div>
    );
  }

  // Authenticated - show avatar and dropdown
  const displayName = user?.displayName || t.anonymous;
  const photoURL = user?.photoURL;
  const email = user?.email;

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {photoURL ? (
          <Image
            src={photoURL}
            alt={displayName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-white">
            <UserIcon />
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-2 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            {email && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {email}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href={localizedHref('/favorites', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <HeartIcon />
              {t.favorites}
            </Link>
            <Link
              href={localizedHref('/watchlist', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <EyeIcon />
              {t.watchlist}
            </Link>
            <Link
              href={localizedHref('/diary', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <BookIcon />
              {t.diary}
            </Link>
            <Link
              href={localizedHref('/lists', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ListIcon />
              {t.lists}
            </Link>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <Link
              href={localizedHref('/alerts', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <BellIcon />
              {t.alerts}
            </Link>
            <Link
              href={localizedHref('/budget', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <CashIcon />
              {t.budget}
            </Link>
            <Link
              href={localizedHref('/sale-calendar', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <CalendarIcon />
              {t.saleCalendar}
            </Link>
            <Link
              href={localizedHref('/settings', locale)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <SettingsIcon />
              {t.settings}
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <LogoutIcon />
              {t.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
