'use client';

import Link from 'next/link';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import { getThemeMode, getPrimaryColor } from '../lib/theme';
import { useReducedMotion } from '../lib/hooks/useReducedMotion';

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
  onSavePerPage?: (perPage: number) => void;
}

export default function Pagination({
  total,
  page,
  perPage,
  basePath,
  queryParams = {},
  position = 'bottom',
  showPerPageSelector = false,
  onSavePerPage,
}: PaginationProps) {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const totalPages = Math.ceil(total / perPage);
  const [inputPage, setInputPage] = useState('');
  const prefersReducedMotion = useReducedMotion();

  const mode = getThemeMode();
  const primaryColor = getPrimaryColor();

  // テーマに応じたスタイルをメモ化
  const styles = useMemo(() => mode === 'dark' ? {
    button: 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600 active:bg-gray-600',
    buttonActive: `bg-${primaryColor}-600 text-white`,
    buttonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
    jumpButton: 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700',
    jumpButtonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
    input: 'border-gray-600 text-white bg-gray-700 focus:ring-rose-500',
    submitButton: `bg-${primaryColor}-600 text-white hover:bg-${primaryColor}-700 disabled:bg-gray-600 disabled:text-gray-400`,
    select: `border-gray-600 text-white bg-gray-700 focus:ring-${primaryColor}-500 focus:border-${primaryColor}-500`,
    pageInfo: 'text-gray-400',
    dots: 'text-gray-400',
  } : {
    button: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 active:bg-gray-100',
    buttonActive: `bg-${primaryColor}-500 text-white`,
    buttonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
    jumpButton: `bg-${primaryColor}-50 text-${primaryColor}-600 hover:bg-${primaryColor}-100 border border-${primaryColor}-200`,
    jumpButtonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
    input: `border-gray-300 text-gray-900 bg-white focus:ring-${primaryColor}-500`,
    submitButton: `bg-${primaryColor}-500 text-white hover:bg-${primaryColor}-600 disabled:bg-gray-200 disabled:text-gray-400`,
    select: `border-gray-300 text-gray-900 bg-white focus:ring-${primaryColor}-500 focus:border-${primaryColor}-500`,
    pageInfo: 'text-gray-500',
    dots: 'text-gray-500',
  }, [mode, primaryColor]);

  // クエリパラメータを保持
  // 注意: queryParams（サーバーサイドから渡される正確な値）を優先し、
  // searchParams（現在のURL）からは hl と limit のみ保持する
  const getUrl = useCallback((pageNum: number, newPerPage?: number) => {
    const urlParams = new URLSearchParams();

    // 言語パラメータを保持（?hl=形式）
    const hlParam = searchParams.get('hl');
    if (hlParam) {
      urlParams.set('hl', hlParam);
    }

    // queryParamsから全フィルターパラメータを設定（サーバーサイドの正確な値）
    Object.entries(queryParams).forEach(([key, value]) => {
      urlParams.set(key, value);
    });

    // ページ番号を設定（1の場合は省略）
    if (pageNum > 1) {
      urlParams.set('page', pageNum.toString());
    }

    // 表示件数を設定（新しい値またはsearchParamsから）
    if (newPerPage) {
      urlParams.set('limit', newPerPage.toString());
    } else {
      const currentLimit = searchParams.get('limit');
      if (currentLimit) {
        urlParams.set('limit', currentLimit);
      }
    }

    const queryString = urlParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }, [searchParams, queryParams, basePath]);

  // スクロールとフォーカス移動
  const scrollToTopAndFocus = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    setTimeout(() => {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.setAttribute('tabindex', '-1');
        mainContent.focus();
        mainContent.removeAttribute('tabindex');
      }
    }, prefersReducedMotion ? 0 : 300);
  }, [prefersReducedMotion]);

  // ページ番号入力での移動
  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = parseInt(inputPage, 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      router.push(getUrl(targetPage));
      setInputPage('');
      scrollToTopAndFocus();
    }
  }, [inputPage, totalPages, router, getUrl, scrollToTopAndFocus]);

  // 入力値の自動補正
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setInputPage('');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      // 範囲外なら自動補正
      const clampedValue = Math.min(Math.max(1, num), totalPages);
      setInputPage(String(clampedValue));
    }
  }, [totalPages]);

  // 表示件数変更
  const handlePerPageChange = useCallback((newPerPage: number) => {
    if (onSavePerPage) {
      onSavePerPage(newPerPage);
    }
    const currentFirstItem = (page - 1) * perPage + 1;
    const newPage = Math.max(1, Math.ceil(currentFirstItem / newPerPage));
    router.push(getUrl(newPage, newPerPage));
    scrollToTopAndFocus();
  }, [page, perPage, router, getUrl, onSavePerPage, scrollToTopAndFocus]);

  const showJumpButtons = totalPages > 10;

  // ページ番号配列をメモ化（page/totalPagesが変わらない限り再計算しない）
  // 注: Reactのhooksルールに従い、条件分岐の前にuseMemoを配置
  const visiblePages = useMemo(() => {
    if (totalPages <= 1) return [1];

    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

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
  }, [page, totalPages]);

  if (totalPages <= 1 && !showPerPageSelector) {
    return null;
  }

  return (
    <nav
      aria-label={`${t.page} ${page} / ${totalPages}`}
      className={`flex flex-col items-center gap-2 sm:gap-3 ${position === 'top' ? 'mb-4 sm:mb-6' : 'mt-6 sm:mt-8'}`}
    >
      {/* メインナビゲーション */}
      <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-2" role="group">
        {/* 最初 */}
        <Link
          href={getUrl(1)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page === 1 ? styles.buttonDisabled : styles.button
          }`}
          aria-disabled={page === 1}
        >
          {t.first}
        </Link>

        {/* -10ジャンプ */}
        {showJumpButtons && (
          <Link
            href={getUrl(Math.max(1, page - 10))}
            className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
              page <= 10 ? styles.jumpButtonDisabled : styles.jumpButton
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
          className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors min-w-[48px] min-h-[48px] sm:min-w-[60px] flex items-center justify-center ${
            page === 1 ? styles.buttonDisabled : styles.button
          }`}
          aria-disabled={page === 1}
        >
          {t.prev}
        </Link>

        {/* ページ番号 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-0.5 sm:gap-1">
            {visiblePages.map((pageNum, index) => {
              if (pageNum === '...') {
                return (
                  <span key={`dots-${index}`} className={`hidden sm:inline px-2 sm:px-3 py-2 text-sm ${styles.dots}`}>
                    ...
                  </span>
                );
              }

              const isCurrent = pageNum === page;
              const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
              const showOnMobile = isCurrent || isFirstOrLast;
              return (
                <Link
                  key={pageNum}
                  href={getUrl(pageNum as number)}
                  className={`${showOnMobile ? '' : 'hidden sm:flex'} px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center ${
                    isCurrent ? styles.buttonActive : styles.button
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
          className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors min-w-[48px] min-h-[48px] sm:min-w-[60px] flex items-center justify-center ${
            page >= totalPages ? styles.buttonDisabled : styles.button
          }`}
          aria-disabled={page >= totalPages}
        >
          {t.next}
        </Link>

        {/* +10ジャンプ */}
        {showJumpButtons && (
          <Link
            href={getUrl(Math.min(totalPages, page + 10))}
            className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
              page > totalPages - 10 ? styles.jumpButtonDisabled : styles.jumpButton
            }`}
            aria-disabled={page > totalPages - 10}
            title="10ページ進む"
          >
            {t.jumpForward}
          </Link>
        )}

        {/* 最後 */}
        <Link
          href={getUrl(totalPages)}
          className={`hidden sm:block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
            page >= totalPages ? styles.buttonDisabled : styles.button
          }`}
          aria-disabled={page >= totalPages}
        >
          {t.last}
        </Link>
      </div>

      {/* ページ情報 + コントロール */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
        {/* ページ情報 */}
        <div className={styles.pageInfo}>
          {total > 0 && (
            <>
              <span className="hidden sm:inline">
                {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} / {total.toLocaleString()} {t.items}
              </span>
              <span className="sm:hidden">
                {page} / {totalPages}
              </span>
            </>
          )}
        </div>

        {/* 直接ページ入力 */}
        {totalPages >= 5 && (
          <form onSubmit={handlePageInputSubmit} className="hidden sm:flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={inputPage}
              onChange={handleInputChange}
              placeholder={t.inputPlaceholder}
              className={`w-20 px-2 py-1.5 text-center border rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent ${styles.input}`}
              aria-label={t.goToPage}
            />
            <button
              type="submit"
              disabled={!inputPage || parseInt(inputPage) < 1 || parseInt(inputPage) > totalPages}
              className={`px-3 py-1.5 rounded-md text-sm font-medium disabled:cursor-not-allowed transition-colors ${styles.submitButton}`}
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
              className={`px-2 sm:px-3 py-1.5 sm:py-2 border rounded-md text-sm sm:text-base ${styles.select}`}
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
