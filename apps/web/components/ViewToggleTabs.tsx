'use client';

import Link from 'next/link';
import { useCallback } from 'react';

interface ViewToggleTabsProps {
  view: 'actresses' | 'products';
  actressHref: string;
  productHref: string;
  actressLabel: string;
  productLabel: string;
  totalCount?: number;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`;
}

export default function ViewToggleTabs({
  view,
  actressHref,
  productHref,
  actressLabel,
  productLabel,
  totalCount,
}: ViewToggleTabsProps) {
  const handleActressClick = useCallback(() => {
    setCookie('preferred_view', 'actresses', 90);
  }, []);

  const handleProductClick = useCallback(() => {
    setCookie('preferred_view', 'products', 90);
  }, []);

  return (
    <div className="mb-2 flex items-center border-b border-white/10">
      <Link
        href={actressHref}
        scroll={false}
        onClick={handleActressClick}
        className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
          view === 'actresses'
            ? 'text-fuchsia-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fuchsia-400'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        {actressLabel}
        <span className={`text-[10px] font-normal ${view === 'actresses' ? 'text-gray-500' : 'text-gray-600'}`}>
          {view === 'actresses' && totalCount ? totalCount.toLocaleString() : ''}
        </span>
      </Link>
      <Link
        href={productHref}
        scroll={false}
        onClick={handleProductClick}
        className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
          view === 'products'
            ? 'text-fuchsia-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fuchsia-400'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        {productLabel}
        <span className={`text-[10px] font-normal ${view === 'products' ? 'text-gray-500' : 'text-gray-600'}`}>
          {view === 'products' && totalCount ? totalCount.toLocaleString() : ''}
        </span>
      </Link>
    </div>
  );
}
