'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-gray-950 text-white border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold tracking-tight">
              <span className="text-rose-400">ADULT</span>
              <span className="text-white">VIEWER LAB</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-white/70">
              heavy user guide
            </span>
          </Link>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-8">
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
              href="/categories"
              className="hover:text-rose-300 transition-colors font-medium"
            >
              ジャンル
            </Link>
            <Link
              href="/featured"
              className="hover:text-rose-300 transition-colors font-medium"
            >
              レビュー
            </Link>
            <Link
              href="/new"
              className="hover:text-rose-300 transition-colors font-medium"
            >
              キャンペーン
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

        {/* モバイルメニュー */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 space-y-2">
            {[
              { href: '/', label: 'ホーム' },
              { href: '/actresses', label: '女優図鑑' },
              { href: '/categories', label: 'ジャンル' },
              { href: '/featured', label: 'レビュー' },
              { href: '/new', label: 'キャンペーン' },
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
