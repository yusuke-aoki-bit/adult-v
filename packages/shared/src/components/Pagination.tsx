'use client';

import Link from 'next/link';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import { getThemeMode, getPrimaryColor } from '../lib/theme';
import { useReducedMotion } from '../lib/hooks/useReducedMotion';
import { getTranslation, paginationTranslations } from '../lib/translations';

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
  const params = useParams();
  const router = useRouter();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getTranslation(paginationTranslations, locale);
  const totalPages = Math.ceil(total / perPage);
  const [inputPage, setInputPage] = useState('');
  const prefersReducedMotion = useReducedMotion();

  const mode = getThemeMode();
  const primaryColor = getPrimaryColor();

  // テーマに応じたスタイルをメモ化
  const styles = useMemo(
    () =>
      mode === 'dark'
        ? {
            button: 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600 active:bg-gray-600',
            buttonActive: `bg-${primaryColor}-600 text-white`,
            buttonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
            jumpButton: 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700',
            jumpButtonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
            input: 'border-gray-600 text-white bg-gray-700 focus:ring-fuchsia-500',
            submitButton: `bg-${primaryColor}-600 text-white hover:bg-${primaryColor}-700 disabled:bg-gray-600 disabled:text-gray-400`,
            pageInfo: 'text-gray-400',
            dots: 'text-gray-400',
          }
        : {
            button: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 active:bg-gray-100',
            buttonActive: `bg-${primaryColor}-500 text-white`,
            buttonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
            jumpButton: `bg-${primaryColor}-50 text-${primaryColor}-600 hover:bg-${primaryColor}-100 border border-${primaryColor}-200`,
            jumpButtonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
            input: `border-gray-300 text-gray-900 bg-white focus:ring-${primaryColor}-500`,
            submitButton: `bg-${primaryColor}-500 text-white hover:bg-${primaryColor}-600 disabled:bg-gray-200 disabled:text-gray-400`,
            pageInfo: 'text-gray-500',
            dots: 'text-gray-500',
          },
    [mode, primaryColor],
  );

  // クエリパラメータを保持
  // 注意: queryParams（サーバーサイドから渡される正確な値）を優先し、
  // searchParams（現在のURL）からは hl のみ保持する
  const getUrl = useCallback(
    (pageNum: number) => {
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

      const queryString = urlParams.toString();
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    [searchParams, queryParams, basePath],
  );

  // スクロールとフォーカス移動
  const scrollToTopAndFocus = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    setTimeout(
      () => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.setAttribute('tabindex', '-1');
          mainContent.focus();
          mainContent.removeAttribute('tabindex');
        }
      },
      prefersReducedMotion ? 0 : 300,
    );
  }, [prefersReducedMotion]);

  // ページ番号入力での移動
  const handlePageInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const targetPage = parseInt(inputPage, 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        router.push(getUrl(targetPage));
        setInputPage('');
        scrollToTopAndFocus();
      }
    },
    [inputPage, totalPages, router, getUrl, scrollToTopAndFocus],
  );

  // 入力値の自動補正
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [totalPages],
  );

  const showJumpButtons = totalPages > 10;

  // ページ番号配列をメモ化（page/totalPagesが変わらない限り再計算しない）
  // 注: Reactのhooksルールに従い、条件分岐の前にuseMemoを配置
  const visiblePages = useMemo(() => {
    if (totalPages <= 1) return [1];

    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
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

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={`${t.page} ${page} / ${totalPages}`}
      className={`flex min-h-[88px] flex-col items-center gap-2 sm:min-h-[104px] sm:gap-3 ${position === 'top' ? 'mb-4 sm:mb-6' : 'mt-6 sm:mt-8'}`}
    >
      {/* メインナビゲーション */}
      <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-2" role="group">
        {/* 最初 */}
        <Link
          href={getUrl(1)}
          className={`hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:block ${
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
            className={`hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:block ${
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
          className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors sm:min-w-[60px] sm:px-4 sm:py-2 sm:text-base ${
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
                  <span key={`dots-${index}`} className={`hidden px-2 py-2 text-sm sm:inline sm:px-3 ${styles.dots}`}>
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
                  className={`${showOnMobile ? '' : 'hidden sm:flex'} flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors sm:px-4 sm:py-2 sm:text-base ${
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
          className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors sm:min-w-[60px] sm:px-4 sm:py-2 sm:text-base ${
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
            className={`hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:block ${
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
          className={`hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:block ${
            page >= totalPages ? styles.buttonDisabled : styles.button
          }`}
          aria-disabled={page >= totalPages}
        >
          {t.last}
        </Link>
      </div>

      {/* ページ情報 + コントロール */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:gap-3 sm:text-base">
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
          <form onSubmit={handlePageInputSubmit} className="hidden items-center gap-1 sm:flex">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={inputPage}
              onChange={handleInputChange}
              placeholder={t.inputPlaceholder}
              className={`w-20 rounded-md border px-2 py-1.5 text-center text-sm focus:border-transparent focus:ring-2 focus:outline-none ${styles.input}`}
              aria-label={t.goToPage}
            />
            <button
              type="submit"
              disabled={!inputPage || parseInt(inputPage) < 1 || parseInt(inputPage) > totalPages}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles.submitButton}`}
            >
              {t.go}
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
