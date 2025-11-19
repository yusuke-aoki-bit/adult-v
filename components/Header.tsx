'use client';

import Link from 'next/link';
import { useState } from 'react';
import SearchBar from './SearchBar';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-gray-950 text-white border-b border-white/10">
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
          <nav className="hidden md:flex items-center space-x-8 flex-shrink-0">
            <Link
              href="/"
              className="hover:text-rose-300 transition-colors font-medium"
            >
              ホーム
            </Link>
            <Link
              href="/actresses"
              className="hover:text-rose-300 transition-colors font-medium"
            >
              女優図鑑
            </Link>
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
          <nav className="md:hidden py-4 space-y-2">
            {[
              { href: '/', label: 'ホーム' },
              { href: '/actresses', label: '女優図鑑' },
              { href: '/favorites', label: 'お気に入り' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block py-2 hover:text-rose-300 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
