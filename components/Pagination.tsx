'use client';

import Link from 'next/link';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    first: '最初',
    prev: '前へ',
    next: '次へ',
    last: '最後',
    items: '件',
    page: 'ページ',
    goToPage: 'ページへ移動',
    inputPlaceholder: 'ページ番号',
    go: '移動',
    jumpBack: '-10',
    jumpForward: '+10',
    perPage: '件/ページ',
  },
  en: {
    first: 'First',
    prev: 'Prev',
    next: 'Next',
    last: 'Last',
    items: 'items',
    page: 'page',
    goToPage: 'Go to page',
    inputPlaceholder: 'Page #',
    go: 'Go',
    jumpBack: '-10',
    jumpForward: '+10',
    perPage: '/page',
  },
  zh: {
    first: '首页',
    prev: '上一页',
    next: '下一页',
    last: '末页',
    items: '条',
    page: '页',
    goToPage: '跳转到',
    inputPlaceholder: '页码',
    go: '跳转',
    jumpBack: '-10',
    jumpForward: '+10',
    perPage: '条/页',
  },
  ko: {
    first: '처음',
    prev: '이전',
    next: '다음',
    last: '마지막',
    items: '건',
    page: '페이지',
    goToPage: '페이지로 이동',
    inputPlaceholder: '페이지 번호',
    go: '이동',
    jumpBack: '-10',
    jumpForward: '+10',
    perPage: '건/페이지',
  },
} as const;

// 表示件数オプション
const PER_PAGE_OPTIONS = [12, 24, 48, 96] as const;

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  queryParams?: Record<string, string>;
  position?: 'top' | 'bottom';
  showPerPageSelector?: boolean;
}

export default function Pagination({
  total,
  page,
  perPage,
  basePath,
  queryParams = {},
  position = 'bottom',
  showPerPageSelector = false,
}: PaginationProps) {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const totalPages = Math.ceil(total / perPage);
  const [inputPage, setInputPage] = useState('');

  // クエリパラメータを保持
  const getUrl = useCallback((pageNum: number, newPerPage?: number) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    Object.entries(queryParams).forEach(([key, value]) => {
      urlParams.set(key, value);
    });
    urlParams.set('page', pageNum.toString());
    if (newPerPage) {
      urlParams.set('limit', newPerPage.toString());
    }
    return `${basePath}?${urlParams.toString()}`;
  }, [searchParams, queryParams, basePath]);

  // ページ番号入力での移動
  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = parseInt(inputPage, 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      router.push(getUrl(targetPage));
      setInputPage('');
    }
  }, [inputPage, totalPages, router, getUrl]);

  // 表示件数変更
  const handlePerPageChange = useCallback((newPerPage: number) => {
    // 現在のアイテム位置を維持するように新しいページを計算
    const currentFirstItem = (page - 1) * perPage + 1;
    const newPage = Math.max(1, Math.ceil(currentFirstItem / newPerPage));
    router.push(getUrl(newPage, newPerPage));
  }, [page, perPage, router, getUrl]);

  if (totalPages <= 1 && !showPerPageSelector) {
    return null;
  }

  // 10ページ以上ある場合はジャンプボタンを表示
  const showJumpButtons = totalPages > 10;

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
    <nav className={`flex flex-col items-center gap-3 min-h-[88px] sm:min-h-[76px] ${position === 'top' ? 'mb-6' : 'mt-8'}`}>
      {/* メインナビゲーション */}
      <div className="flex flex-wrap items-center justify-center gap-2 min-h-[40px]">
        {/* 最初 - デスクトップのみ */}
        <Link
          href={getUrl(1)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page === 1
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
          }`}
          aria-disabled={page === 1}
        >
          {t.first}
        </Link>

        {/* -10ジャンプ - デスクトップ & ページ数が多い場合 */}
        {showJumpButtons && (
          <Link
            href={getUrl(Math.max(1, page - 10))}
            className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
              page <= 10
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
                : 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700'
            }`}
            aria-disabled={page <= 10}
            title="10ページ戻る"
          >
            {t.jumpBack}
          </Link>
        )}

        {/* 前へ */}
        <Link
          href={getUrl(page - 1)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors min-w-[60px] text-center ${
            page === 1
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600 active:bg-gray-600'
          }`}
          aria-disabled={page === 1}
        >
          {t.prev}
        </Link>

        {/* ページ番号 */}
        {totalPages > 1 && (
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
                      : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600 active:bg-gray-600'
                  }`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {pageNum}
                </Link>
              );
            })}
          </div>
        )}

        {/* 次へ */}
        <Link
          href={getUrl(page + 1)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors min-w-[60px] text-center ${
            page >= totalPages
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600 active:bg-gray-600'
          }`}
          aria-disabled={page >= totalPages}
        >
          {t.next}
        </Link>

        {/* +10ジャンプ - デスクトップ & ページ数が多い場合 */}
        {showJumpButtons && (
          <Link
            href={getUrl(Math.min(totalPages, page + 10))}
            className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
              page > totalPages - 10
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
                : 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700'
            }`}
            aria-disabled={page > totalPages - 10}
            title="10ページ進む"
          >
            {t.jumpForward}
          </Link>
        )}

        {/* 最後 - デスクトップのみ */}
        <Link
          href={getUrl(totalPages)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page >= totalPages
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
          }`}
          aria-disabled={page >= totalPages}
        >
          {t.last}
        </Link>
      </div>

      {/* ページ情報 + コントロール */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
        {/* ページ情報 */}
        <div className="text-gray-500">
          {total > 0 && (
            <>
              <span className="hidden sm:inline">
                {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total.toLocaleString()} {t.items}
              </span>
              <span className="sm:hidden">
                {page} / {totalPages} {t.page}
              </span>
            </>
          )}
        </div>

        {/* 直接ページ入力 - ページ数が5以上の場合のみ表示 */}
        {totalPages >= 5 && (
          <form onSubmit={handlePageInputSubmit} className="hidden sm:flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              placeholder={t.inputPlaceholder}
              className="w-20 px-2 py-1.5 text-center border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              aria-label={t.goToPage}
            />
            <button
              type="submit"
              disabled={!inputPage || parseInt(inputPage) < 1 || parseInt(inputPage) > totalPages}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-medium hover:bg-rose-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {t.go}
            </button>
          </form>
        )}

        {/* 表示件数セレクター */}
        {showPerPageSelector && (
          <div className="flex items-center gap-1">
            <select
              value={perPage}
              onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:ring-rose-500 focus:border-rose-500"
              aria-label="表示件数"
            >
              {PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}{t.perPage}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </nav>
  );
}
