'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  queryParams?: Record<string, string>;
  position?: 'top' | 'bottom';
}

export default function Pagination({
  total,
  page,
  perPage,
  basePath,
  queryParams = {},
  position = 'bottom',
}: PaginationProps) {
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / perPage);


  // クエリパラメータを保持
  const getUrl = (pageNum: number) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(queryParams).forEach(([key, value]) => {
      params.set(key, value);
    });
    params.set('page', pageNum.toString());
    return `${basePath}?${params.toString()}`;
  };

  if (totalPages <= 1) {
    return null;
  }

  const getVisiblePages = () => {
    // モバイルでは delta=1、デスクトップでは delta=2
    const delta = typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (page + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  return (
    <nav className={`flex flex-col sm:flex-row items-center justify-center gap-3 ${position === 'top' ? 'mb-6' : 'mt-8'}`}>
      {/* モバイル: 前へ/次へ + ページ情報のみ */}
      <div className="flex items-center gap-2">
        {/* 最初 - デスクトップのみ */}
        <Link
          href={getUrl(1)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
          }`}
          aria-disabled={page === 1}
        >
          最初
        </Link>

        {/* 前へ */}
        <Link
          href={getUrl(page - 1)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors min-w-[60px] text-center ${
            page === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 active:bg-gray-200'
          }`}
          aria-disabled={page === 1}
        >
          前へ
        </Link>

        {/* ページ番号 */}
        <div className="flex items-center gap-1">
          {getVisiblePages().map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <span key={`dots-${index}`} className="px-2 sm:px-3 py-2 text-gray-400 text-sm">
                  ...
                </span>
              );
            }

            const isCurrent = pageNum === page;
            return (
              <Link
                key={pageNum}
                href={getUrl(pageNum as number)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  isCurrent
                    ? 'bg-rose-600 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 active:bg-gray-200'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        {/* 次へ */}
        <Link
          href={getUrl(page + 1)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors min-w-[60px] text-center ${
            page >= totalPages
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 active:bg-gray-200'
          }`}
          aria-disabled={page >= totalPages}
        >
          次へ
        </Link>

        {/* 最後 - デスクトップのみ */}
        <Link
          href={getUrl(totalPages)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page >= totalPages
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
          }`}
          aria-disabled={page >= totalPages}
        >
          最後
        </Link>
      </div>

      {/* ページ情報 */}
      <div className="text-xs sm:text-sm text-gray-500">
        {total > 0 && (
          <>
            <span className="hidden sm:inline">
              {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total.toLocaleString()}件
            </span>
            <span className="sm:hidden">
              {page} / {totalPages}ページ
            </span>
          </>
        )}
      </div>
    </nav>
  );
}
