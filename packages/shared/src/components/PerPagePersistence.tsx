'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getPerPage, savePerPage } from '../lib/filter-storage';

/**
 * 一覧ページの表示件数をlocalStorageに保存・復元するコンポーネント
 * - 全一覧ページで共通の表示件数を保持
 * - URLにlimitパラメータがない場合、localStorageから復元してリダイレクト
 * - URLにlimitパラメータがある場合、localStorageに保存
 */
export default function PerPagePersistence() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasRestored = useRef<string | null>(null);

  useEffect(() => {
    // 一覧ページかどうかを判定（女優一覧、商品一覧、検索結果など）
    const isListPage =
      pathname === '/' ||
      pathname?.match(/^\/[a-z]{2}$/) ||  // /ja, /en など
      pathname?.match(/^\/[a-z]{2}\/products/) ||
      pathname?.match(/^\/[a-z]{2}\/actress\//) ||
      pathname?.match(/^\/[a-z]{2}\/search/);

    if (!isListPage) {
      return;
    }

    const limit = searchParams.get('limit');

    // URLにlimitパラメータがある場合は保存
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum)) {
        savePerPage(limitNum);
      }
      return;
    }

    // すでにこのパスで復元済みの場合はスキップ
    if (hasRestored.current === pathname) {
      return;
    }

    // URLにlimitパラメータがない場合、localStorageから復元
    const savedPerPage = getPerPage();
    if (savedPerPage) {
      hasRestored.current = pathname;

      // 既存のクエリパラメータを保持してlimitを追加
      const params = new URLSearchParams(searchParams.toString());
      params.set('limit', savedPerPage.toString());

      const newUrl = `${pathname}?${params.toString()}`;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router]);

  return null;
}
