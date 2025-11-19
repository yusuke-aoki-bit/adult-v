'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  queryParams?: Record<string, string>;
}

export default function Pagination({
  total,
  page,
  perPage,
  basePath,
  queryParams = {},
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
    const delta = 2;
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
    <nav className="flex items-center justify-center gap-2 mt-8">
      <Link
        href={getUrl(page - 1)}
        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
          page === 1
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
        }`}
        aria-disabled={page === 1}
      >
        前へ
      </Link>

      <div className="flex items-center gap-1">
        {getVisiblePages().map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <span key={`dots-${index}`} className="px-4 py-2 text-gray-400">
                ...
              </span>
            );
          }

          const isCurrent = pageNum === page;
          return (
            <Link
              key={pageNum}
              href={getUrl(pageNum as number)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isCurrent
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
              }`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>

      <Link
        href={getUrl(page + 1)}
        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
          page >= totalPages
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
        }`}
        aria-disabled={page >= totalPages}
      >
        次へ
      </Link>

      <div className="ml-4 text-sm text-gray-600">
        {total > 0 && (
          <>
            {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total}件
          </>
        )}
      </div>
    </nav>
  );
}

