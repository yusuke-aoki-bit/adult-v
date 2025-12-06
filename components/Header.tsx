'use client';

import Link from 'next/link';
import { useState } from 'react';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationSubscriber from './NotificationSubscriber';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-gray-950 text-white border-b border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* ロゴ */}
          <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
            <div className="text-2xl font-bold tracking-tight">
              <span className="text-rose-400">ADULT</span>
              <span className="text-white">VIEWER LAB</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-white/70 hidden sm:inline">
              heavy user guide
            </span>
          </Link>

          {/* 検索バー（デスクトップ） */}
          <div className="hidden md:block flex-1 max-w-md">
            <SearchBar />
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-4 flex-shrink-0">
            <Link
              href="/categories"
              className="hover:text-purple-300 transition-colors font-medium flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              カテゴリ
            </Link>
            <Link
              href="/reviews"
              className="hover:text-blue-300 transition-colors font-medium flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              レビュー
            </Link>
            <NotificationSubscriber />
            <Link
              href="/favorites"
              className="hover:text-rose-300 transition-colors font-medium flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              お気に入り
            </Link>
            <LanguageSwitcher />
          </nav>

          {/* モバイルメニューボタン */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="メニュー"
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
              href="/categories"
              className="block py-2 hover:text-purple-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              カテゴリ
            </Link>
            <Link
              href="/reviews"
              className="block py-2 hover:text-blue-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              レビュー
            </Link>
            <div className="py-2">
              <NotificationSubscriber />
            </div>
            <Link
              href="/favorites"
              className="block py-2 hover:text-rose-300 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              お気に入り
            </Link>
            <div className="py-2">
              <LanguageSwitcher />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
