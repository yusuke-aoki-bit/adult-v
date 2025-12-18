'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getFilterSettings, saveFilterSettings, clearFilterSettings } from '../lib/filter-storage';

/**
 * フィルター設定をlocalStorageに保存・復元するコンポーネント
 * - トップページ（/）と女優詳細ページ（/actress/xxx）で別々に保存
 * - URLにフィルターパラメータがない場合、localStorageから復元してリダイレクト
 * - URLにフィルターパラメータがある場合、localStorageに保存
 * - クリアボタンでlocalStorageも削除
 */
export default function FilterPersistence() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasRestored = useRef<string | null>(null);

  useEffect(() => {
    // トップページまたは女優詳細ページでのみ動作
    const isHomePage = pathname === '/';
    const isActressPage = pathname.startsWith('/actress/');

    if (!isHomePage && !isActressPage) {
      return;
    }

    const pageType = isHomePage ? 'home' : 'actress';
    const include = searchParams.get('include');
    const exclude = searchParams.get('exclude');
    const sort = searchParams.get('sort');
    const page = searchParams.get('page');
    const query = searchParams.get('q');

    // URLにフィルターパラメータがある場合は保存
    if (include || exclude || sort) {
      const settings = {
        includeTags: include ? include.split(',').filter(Boolean) : [],
        excludeTags: exclude ? exclude.split(',').filter(Boolean) : [],
        sortBy: sort || undefined,
      };
      saveFilterSettings(pageType, settings);
      return;
    }

    // すでにこのパスで復元済みの場合はスキップ
    if (hasRestored.current === pathname) {
      return;
    }

    // URLにフィルターパラメータがない場合、localStorageから復元
    const saved = getFilterSettings(pageType);
    if (saved && (saved.includeTags.length > 0 || saved.excludeTags.length > 0 || saved.sortBy)) {
      hasRestored.current = pathname;

      // URLを構築
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (page) params.set('page', page);
      if (saved.includeTags.length > 0) params.set('include', saved.includeTags.join(','));
      if (saved.excludeTags.length > 0) params.set('exclude', saved.excludeTags.join(','));
      if (saved.sortBy) params.set('sort', saved.sortBy);

      const newUrl = `${pathname}?${params.toString()}`;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router]);

  // クリアリンクのクリックを監視してlocalStorageも削除
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (!href) return;

        // トップページのフィルタークリア
        if (href === '/' || (href.startsWith('/?q=') && !href.includes('include') && !href.includes('exclude') && !href.includes('sort'))) {
          clearFilterSettings('home');
        }
        // 女優詳細ページのフィルタークリア
        else if (href.startsWith('/actress/') && !href.includes('include') && !href.includes('exclude') && !href.includes('?')) {
          clearFilterSettings('actress');
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
